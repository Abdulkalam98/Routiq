"""
API Keys management router - POST/GET/DELETE /keys
Uses JWT-based auth (dashboard users), not API key auth.
"""

import secrets
import time
from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_async_session

router = APIRouter(tags=["API Keys"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class CreateKeyRequest(BaseModel):
    name: str


class CreateKeyResponse(BaseModel):
    id: str
    key: str  # Full key returned ONCE at creation
    name: str
    prefix: str
    created_at: str


class KeyInfo(BaseModel):
    id: str
    prefix: str
    name: str
    is_active: bool
    created_at: str
    last_used_at: str | None = None


class KeyListResponse(BaseModel):
    object: str = "list"
    data: list[KeyInfo]


# ---------------------------------------------------------------------------
# JWT Auth dependency (for dashboard users, different from API key auth)
# ---------------------------------------------------------------------------


async def get_current_user_jwt(authorization: str = Header(...)) -> dict:
    """
    Validate JWT token from Authorization: Bearer <token> header.
    Returns the decoded payload with customer info.
    This is separate from the API key auth used for chat endpoints.
    """
    settings = get_settings()

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid authorization header. Expected: Bearer <token>",
                    "type": "authentication_error",
                    "code": "invalid_auth_header",
                }
            },
        )

    token = authorization[7:]  # Strip "Bearer "

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid or expired token.",
                    "type": "authentication_error",
                    "code": "invalid_token",
                }
            },
        )

    customer_id = payload.get("sub") or payload.get("customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Token missing customer identity.",
                    "type": "authentication_error",
                    "code": "invalid_token",
                }
            },
        )

    return {
        "customer_id": customer_id,
        "email": payload.get("email"),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_api_key() -> str:
    """Generate a new API key: rq_ + 32 random alphanumeric characters."""
    random_part = secrets.token_urlsafe(24)[:32]  # 32 URL-safe chars
    return f"rq_{random_part}"


def _hash_key(key: str) -> str:
    """Hash the API key with bcrypt for storage."""
    return bcrypt.hashpw(key.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _get_prefix(key: str) -> str:
    """Extract the prefix (first 10 characters) for display."""
    return key[:10]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/keys", response_model=CreateKeyResponse)
async def create_key(
    body: CreateKeyRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Create a new API key for the authenticated customer.
    The full key is returned ONCE in this response - it cannot be retrieved again.
    """
    from models.api_key import ApiKey

    raw_key = _generate_api_key()
    key_hash = _hash_key(raw_key)
    prefix = _get_prefix(raw_key)
    now = datetime.now(timezone.utc)

    api_key = ApiKey(
        customer_id=user["customer_id"],
        name=body.name,
        key_hash=key_hash,
        prefix=prefix,
        is_active=True,
        created_at=now,
    )

    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return CreateKeyResponse(
        id=str(api_key.id),
        key=raw_key,
        name=api_key.name,
        prefix=prefix,
        created_at=now.isoformat(),
    )


@router.get("/keys", response_model=KeyListResponse)
async def list_keys(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_async_session),
):
    """
    List all API keys for the authenticated customer.
    Never returns the full key - only prefix, name, and metadata.
    """
    from models.api_key import ApiKey

    result = await session.execute(
        select(ApiKey).where(ApiKey.customer_id == user["customer_id"])
    )
    keys = result.scalars().all()

    data = [
        KeyInfo(
            id=str(k.id),
            prefix=k.prefix,
            name=k.name,
            is_active=k.is_active,
            created_at=k.created_at.isoformat() if k.created_at else "",
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
        )
        for k in keys
    ]

    return KeyListResponse(data=data)


@router.delete("/keys/{key_id}")
async def revoke_key(
    key_id: str,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Revoke an API key by setting is_active = False.
    The key will no longer authenticate requests.
    """
    from models.api_key import ApiKey

    result = await session.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.customer_id == user["customer_id"],
        )
    )
    api_key = result.scalar_one_or_none()

    if api_key is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "message": f"API key '{key_id}' not found.",
                    "type": "invalid_request_error",
                    "code": "key_not_found",
                }
            },
        )

    api_key.is_active = False
    await session.commit()

    return JSONResponse(
        content={
            "id": key_id,
            "object": "api_key",
            "deleted": True,
        }
    )
