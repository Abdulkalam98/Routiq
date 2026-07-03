"""Model router - routes requests to the correct LLM provider."""

from functools import lru_cache
from typing import Optional

from config import get_settings
from .providers.base import BaseLLMProvider
from .providers.openai import OpenAIProvider
from .providers.anthropic import AnthropicProvider
from .providers.google import GoogleProvider
from .providers.mistral import MistralProvider


# Provider registry (singleton instances)
_provider_instances: dict[str, BaseLLMProvider] = {}


def _get_openai_provider() -> OpenAIProvider:
    """Get or create OpenAI provider instance."""
    if "openai" not in _provider_instances:
        settings = get_settings()
        _provider_instances["openai"] = OpenAIProvider(api_key=settings.openai_api_key)
    return _provider_instances["openai"]  # type: ignore


def _get_anthropic_provider() -> AnthropicProvider:
    """Get or create Anthropic provider instance."""
    if "anthropic" not in _provider_instances:
        settings = get_settings()
        _provider_instances["anthropic"] = AnthropicProvider(api_key=settings.anthropic_api_key)
    return _provider_instances["anthropic"]  # type: ignore


def _get_google_provider() -> GoogleProvider:
    """Get or create Google provider instance."""
    if "google" not in _provider_instances:
        settings = get_settings()
        _provider_instances["google"] = GoogleProvider(api_key=settings.google_api_key)
    return _provider_instances["google"]  # type: ignore


def _get_mistral_provider() -> MistralProvider:
    """Get or create Mistral provider instance."""
    if "mistral" not in _provider_instances:
        settings = get_settings()
        _provider_instances["mistral"] = MistralProvider(api_key=settings.mistral_api_key)
    return _provider_instances["mistral"]  # type: ignore


# Ordered list of provider names for fallback chain
FALLBACK_CHAIN = ["openai", "anthropic", "google", "mistral"]

# Map provider names to getter functions
PROVIDER_GETTERS = {
    "openai": _get_openai_provider,
    "anthropic": _get_anthropic_provider,
    "google": _get_google_provider,
    "mistral": _get_mistral_provider,
}

# Default models when falling back to a different provider
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku",
    "google": "gemini-flash",
    "mistral": "mistral-small",
}


def get_provider(model_name: str) -> tuple[BaseLLMProvider, str]:
    """
    Get the correct provider instance and resolved model for a given model name.

    Args:
        model_name: The model name from the request (e.g., "gpt-4o", "claude-sonnet-4-6", "auto")

    Returns:
        Tuple of (provider_instance, model_name_to_use)

    Raises:
        ValueError: If the model name cannot be routed to any provider.
    """
    if model_name == "auto":
        # Default fallback for auto (smart routing handles this separately)
        return _get_google_provider(), "gemini-flash"

    if model_name.startswith("gpt-"):
        return _get_openai_provider(), model_name

    if model_name.startswith("claude-"):
        return _get_anthropic_provider(), model_name

    if model_name.startswith("gemini-"):
        return _get_google_provider(), model_name

    if model_name.startswith("mistral-"):
        return _get_mistral_provider(), model_name

    raise ValueError(
        f"Unknown model '{model_name}'. Supported prefixes: gpt-*, claude-*, gemini-*, mistral-*, or 'auto'."
    )


def get_provider_smart(messages: list[dict]) -> tuple[BaseLLMProvider, str, str]:
    """
    Smart routing: analyze messages and pick the cheapest adequate model.

    Returns:
        Tuple of (provider_instance, resolved_model_for_provider, actual_model_name_for_cost)
    """
    from services.smart_router import smart_route

    selected_model = smart_route(messages)
    provider, resolved = get_provider(selected_model)
    return provider, resolved, selected_model


def get_provider_name(model_name: str) -> str:
    """Get the provider name string for a model."""
    if model_name == "auto":
        return "google"
    if model_name.startswith("gpt-"):
        return "openai"
    if model_name.startswith("claude-"):
        return "anthropic"
    if model_name.startswith("gemini-"):
        return "google"
    if model_name.startswith("mistral-"):
        return "mistral"
    raise ValueError(f"Unknown model '{model_name}'.")


def get_fallback_provider(
    model_name: str,
) -> Optional[tuple[BaseLLMProvider, str]]:
    """
    Get a fallback provider when the primary provider fails.

    Follows the fallback chain: OpenAI -> Anthropic -> Google -> Mistral
    Skips the provider that originally failed and providers without API keys.

    Args:
        model_name: The model name that failed (used to determine which provider to skip).

    Returns:
        Tuple of (provider_instance, fallback_model_name) or None if no fallback available.
    """
    settings = get_settings()
    api_keys = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "google": settings.google_api_key,
        "mistral": settings.mistral_api_key,
    }

    try:
        failed_provider = get_provider_name(model_name)
    except ValueError:
        failed_provider = None

    for provider_name in FALLBACK_CHAIN:
        if provider_name == failed_provider:
            continue
        if not api_keys.get(provider_name):
            continue

        getter = PROVIDER_GETTERS[provider_name]
        fallback_model = DEFAULT_MODELS[provider_name]
        return getter(), fallback_model

    return None


async def cleanup_providers():
    """Close all provider HTTP clients. Call on application shutdown."""
    for provider in _provider_instances.values():
        await provider.close()
    _provider_instances.clear()
