"""
Provider keys router — CRUD for BYOK (Bring Your Own Keys).
JWT-authenticated endpoints for managing user's own LLM provider API keys.
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.keys import get_current_user_jwt
from models.user_provider_key import UserProviderKey
from services.encryption import encrypt_key, decrypt_key
from services.byok import invalidate_byok_cache, PROVIDER_CLASSES

logger = logging.getLogger("routiq.provider_keys")

router = APIRouter(prefix="/provider-keys", tags=["Provider Keys"])

VALID_PROVIDERS = ["openai", "anthropic", "google", "mistral"]


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class CreateProviderKeyRequest(BaseModel):
    provider: str
    api_key: str
    label: str | None = None


class UpdateProviderKeyRequest(BaseModel):
    api_key: str
    label: str | None = None


class ProviderKeyResponse(BaseModel):
    provider: str
    key_label: str | None
    key_suffix: str  # last 4 chars
    is_active: bool
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_provider_keys(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """List all provider keys for the authenticated user (keys are masked)."""
    customer_id = user["customer_id"]

    result = await session.execute(
        select(UserProviderKey).where(
            UserProviderKey.customer_id == customer_id,
        )
    )
    keys = result.scalars().all()

    return {
        "data": [
            {
                "provider": key.provider,
                "key_label": key.key_label,
                "key_suffix": "..." + decrypt_key(key.encrypted_key)[-4:] if key.encrypted_key else "",
                "is_active": key.is_active,
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "updated_at": key.updated_at.isoformat() if key.updated_at else None,
            }
            for key in keys
        ]
    }


@router.post("")
async def create_provider_key(
    body: CreateProviderKeyRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """Add or replace a provider API key."""
    if body.provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(VALID_PROVIDERS)}",
        )

    if not body.api_key or len(body.api_key) < 10:
        raise HTTPException(status_code=400, detail="API key too short")

    customer_id = user["customer_id"]

    # Check if key already exists for this provider
    existing = await session.execute(
        select(UserProviderKey).where(
            UserProviderKey.customer_id == customer_id,
            UserProviderKey.provider == body.provider,
        )
    )
    existing_key = existing.scalar_one_or_none()

    encrypted = encrypt_key(body.api_key)

    if existing_key:
        # Update existing
        existing_key.encrypted_key = encrypted
        existing_key.key_label = body.label or existing_key.key_label
        existing_key.is_active = True
        existing_key.updated_at = datetime.now(timezone.utc)
    else:
        # Create new
        new_key = UserProviderKey(
            id=uuid.uuid4(),
            customer_id=customer_id,
            provider=body.provider,
            encrypted_key=encrypted,
            key_label=body.label or f"My {body.provider.title()} Key",
            is_active=True,
        )
        session.add(new_key)

    await session.commit()

    # Invalidate cache so next request uses new key
    invalidate_byok_cache(str(customer_id), body.provider)

    return {
        "provider": body.provider,
        "status": "saved",
        "message": f"{body.provider.title()} API key saved successfully",
    }


@router.put("/{provider}")
async def update_provider_key(
    provider: str,
    body: UpdateProviderKeyRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """Update an existing provider key."""
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    customer_id = user["customer_id"]

    result = await session.execute(
        select(UserProviderKey).where(
            UserProviderKey.customer_id == customer_id,
            UserProviderKey.provider == provider,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail=f"No key found for {provider}")

    key.encrypted_key = encrypt_key(body.api_key)
    if body.label:
        key.key_label = body.label
    key.updated_at = datetime.now(timezone.utc)
    key.is_active = True
    await session.commit()

    invalidate_byok_cache(str(customer_id), provider)

    return {"provider": provider, "status": "updated"}


@router.delete("/{provider}")
async def delete_provider_key(
    provider: str,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """Delete a provider key (reverts to platform key)."""
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    customer_id = user["customer_id"]

    result = await session.execute(
        delete(UserProviderKey).where(
            UserProviderKey.customer_id == customer_id,
            UserProviderKey.provider == provider,
        )
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"No key found for {provider}")

    await session.commit()
    invalidate_byok_cache(str(customer_id), provider)

    return {"provider": provider, "status": "deleted", "message": f"Reverted to platform key for {provider}"}


@router.post("/{provider}/test")
async def test_provider_key(
    provider: str,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """Test if a stored provider key is valid by making a tiny API call."""
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    customer_id = user["customer_id"]

    # Fetch the key
    result = await session.execute(
        select(UserProviderKey.encrypted_key).where(
            UserProviderKey.customer_id == customer_id,
            UserProviderKey.provider == provider,
            UserProviderKey.is_active == True,
        )
    )
    encrypted = result.scalar_one_or_none()
    if not encrypted:
        raise HTTPException(status_code=404, detail=f"No active key found for {provider}")

    # Decrypt and test
    try:
        api_key = decrypt_key(encrypted)
    except ValueError as e:
        return {"provider": provider, "status": "error", "message": str(e)}

    # Create a temporary provider and make a minimal call
    provider_class = PROVIDER_CLASSES.get(provider)
    if not provider_class:
        return {"provider": provider, "status": "error", "message": "Unknown provider"}

    test_provider = provider_class(api_key=api_key)
    try:
        # Minimal test: send a tiny request
        result = await test_provider.chat_completion(
            model=test_provider.resolve_model(_get_test_model(provider)),
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
        await test_provider.close()
        return {"provider": provider, "status": "valid", "message": "Key authenticated successfully"}
    except Exception as e:
        await test_provider.close()
        error_msg = str(e)[:200]
        return {"provider": provider, "status": "invalid", "message": f"Authentication failed: {error_msg}"}


def _get_test_model(provider: str) -> str:
    """Get a cheap model to test with."""
    test_models = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-haiku",
        "google": "gemini-flash",
        "mistral": "mistral-small",
    }
    return test_models.get(provider, "")
