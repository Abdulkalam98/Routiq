"""
BYOK (Bring Your Own Keys) provider resolution.

Checks if a customer has their own API key for a provider.
If yes: creates/caches a provider instance with their key.
If no: falls through to global provider (platform key).

Design:
- One key per provider per customer (UNIQUE constraint)
- Provider instances cached by (customer_id, provider) with TTL
- NO global fallback when BYOK key fails (user's key, user's risk)
"""

import logging
import time
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models.user_provider_key import UserProviderKey
from services.encryption import decrypt_key
from services.router import (
    get_provider,
    get_provider_smart,
    get_provider_name,
    BaseLLMProvider,
)
from services.providers.openai import OpenAIProvider
from services.providers.anthropic import AnthropicProvider
from services.providers.google import GoogleProvider
from services.providers.mistral import MistralProvider

logger = logging.getLogger("routiq.byok")

# Cache BYOK provider instances: key=(customer_id, provider) -> (instance, created_at)
# Simple dict with manual TTL check (avoids extra dependency)
_byok_cache: dict[tuple[str, str], tuple[BaseLLMProvider, float]] = {}
_CACHE_TTL = 300  # 5 minutes
_CACHE_MAX_SIZE = 500

# Map provider names to provider classes
PROVIDER_CLASSES = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "google": GoogleProvider,
    "mistral": MistralProvider,
}


def _evict_stale():
    """Remove expired entries from cache."""
    now = time.time()
    stale_keys = [k for k, (_, ts) in _byok_cache.items() if now - ts > _CACHE_TTL]
    for k in stale_keys:
        del _byok_cache[k]


def invalidate_byok_cache(customer_id: str, provider: str):
    """Remove a specific customer's provider from cache (call on key update/delete)."""
    key = (str(customer_id), provider)
    _byok_cache.pop(key, None)


async def _get_customer_key(customer_id: uuid.UUID, provider_name: str) -> Optional[str]:
    """Fetch and decrypt a customer's provider key from the database."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(UserProviderKey.encrypted_key).where(
                    UserProviderKey.customer_id == customer_id,
                    UserProviderKey.provider == provider_name,
                    UserProviderKey.is_active == True,
                )
            )
            row = result.scalar_one_or_none()
            if row:
                return decrypt_key(row)
    except Exception as e:
        logger.warning("Failed to fetch BYOK key for %s/%s: %s", customer_id, provider_name, e)
    return None


def _get_or_create_provider(
    customer_id: str, provider_name: str, api_key: str
) -> BaseLLMProvider:
    """Get a cached BYOK provider instance or create a new one."""
    cache_key = (customer_id, provider_name)
    now = time.time()

    # Check cache
    if cache_key in _byok_cache:
        instance, created_at = _byok_cache[cache_key]
        if now - created_at < _CACHE_TTL:
            return instance

    # Evict stale entries if cache is getting large
    if len(_byok_cache) >= _CACHE_MAX_SIZE:
        _evict_stale()

    # Create new provider instance with customer's key
    provider_class = PROVIDER_CLASSES.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown provider: {provider_name}")

    instance = provider_class(api_key=api_key)
    _byok_cache[cache_key] = (instance, now)
    return instance


async def get_provider_for_customer(
    customer_id: uuid.UUID,
    model_name: str,
    messages: list[dict] | None = None,
) -> tuple[BaseLLMProvider, str, str]:
    """
    Resolve provider for a customer, checking BYOK keys first.

    Returns:
        (provider_instance, resolved_model, key_source)
        key_source is "own" if using customer's key, "platform" if using global.
    """
    # Handle smart routing (model="auto")
    if model_name == "auto":
        provider, resolved_model, actual_model = get_provider_smart(messages or [])
        provider_name = get_provider_name(actual_model)
    else:
        provider_name = get_provider_name(model_name)
        _, resolved_model = get_provider(model_name)
        actual_model = model_name

    # Check if customer has their own key for this provider
    customer_key = await _get_customer_key(customer_id, provider_name)

    if customer_key:
        # Use customer's own key
        byok_provider = _get_or_create_provider(
            str(customer_id), provider_name, customer_key
        )
        return byok_provider, resolved_model, "own"

    # No BYOK key — use global platform provider
    provider, resolved_model = get_provider(actual_model if model_name != "auto" else actual_model)
    return provider, resolved_model, "platform"
