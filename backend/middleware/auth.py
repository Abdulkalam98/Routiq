"""
API Key authentication middleware for Routiq.

Validates API keys from Authorization or X-API-Key headers,
verifies against bcrypt hashes stored in PostgreSQL, and returns
the authenticated customer.
"""

import asyncio
from datetime import datetime, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import AsyncSessionLocal
from models.customer import Customer
from models.api_key import ApiKey


async def get_db_session() -> AsyncSession:
    """Yield an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


def _extract_api_key(request: Request) -> str:
    """
    Extract the API key from the request headers.

    Checks Authorization: Bearer rq_... first, then X-API-Key: rq_...
    Raises 401 if no valid key is found.
    """
    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            key = parts[1].strip()
            if key.startswith("rq_"):
                return key

    # Try X-API-Key header
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        key = api_key_header.strip()
        if key.startswith("rq_"):
            return key

    raise HTTPException(
        status_code=401,
        detail={
            "error": {
                "message": "Invalid API key",
                "type": "authentication_error",
                "code": "invalid_api_key",
            }
        },
    )


def _verify_key(plain_key: str, key_hash: str) -> bool:
    """Verify a plain API key against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_key.encode("utf-8"),
        key_hash.encode("utf-8"),
    )


async def _update_last_used(api_key_id: str) -> None:
    """Fire-and-forget update of last_used_at timestamp."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ApiKey)
                .where(ApiKey.id == api_key_id)
                .values(last_used_at=datetime.now(timezone.utc))
            )
            await session.commit()
    except Exception:
        # Non-critical operation — silently ignore failures
        pass


async def get_current_customer(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    """
    FastAPI dependency that authenticates the request via API key.

    Extracts the key from headers, verifies it against stored bcrypt
    hashes (narrowed by key_prefix), and returns the associated Customer.
    """
    plain_key = _extract_api_key(request)

    # The key_prefix is the first 10 characters (e.g., "rq_abc12xy")
    # used to narrow the database search before doing bcrypt verification
    # Must match _get_prefix() in routers/keys.py which stores key[:10]
    key_prefix = plain_key[:10]

    # Look up candidate keys by prefix
    result = await session.execute(
        select(ApiKey)
        .where(ApiKey.key_prefix == key_prefix, ApiKey.is_active == True)
        .options(selectinload(ApiKey.customer))
    )
    candidate_keys = result.scalars().all()

    if not candidate_keys:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid API key",
                    "type": "authentication_error",
                    "code": "invalid_api_key",
                }
            },
        )

    # Verify against each candidate (typically just one match by prefix)
    for api_key in candidate_keys:
        if _verify_key(plain_key, api_key.key_hash):
            # Found a valid key — fire-and-forget the last_used_at update
            asyncio.create_task(_update_last_used(api_key.id))
            # Store key ID for downstream middleware (token budget, audit)
            request.state.api_key_id = str(api_key.id)
            return api_key.customer

    # No matching key found
    raise HTTPException(
        status_code=401,
        detail={
            "error": {
                "message": "Invalid API key",
                "type": "authentication_error",
                "code": "invalid_api_key",
            }
        },
    )
