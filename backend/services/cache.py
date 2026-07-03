"""
Exact-match response caching using Upstash Redis REST API.
Hashes model + messages to create cache keys. TTL = 1 hour.
Uses only 2 Redis commands per request (GET + optional SET).
Fails open: if Redis is unreachable, request proceeds normally.
"""

import hashlib
import json
from typing import Optional

import httpx

from config import get_settings

CACHE_TTL = 3600  # 1 hour
CACHE_PREFIX = "cache:"


def _build_cache_key(model: str, messages: list[dict]) -> str:
    """
    Build a deterministic cache key from model + messages.
    Only considers role and content (not metadata).
    """
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": m["role"], "content": m["content"]} for m in messages
            ],
        },
        sort_keys=True,
    )
    digest = hashlib.sha256(payload.encode()).hexdigest()[:32]
    return f"{CACHE_PREFIX}{digest}"


async def get_cached_response(model: str, messages: list[dict]) -> Optional[dict]:
    """
    Check Redis for a cached response. Returns parsed dict or None.
    Uses 1 Redis command (GET).
    """
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return None

    key = _build_cache_key(model, messages)

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                f"{settings.upstash_redis_url}",
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=["GET", key],
            )
            if resp.status_code == 200:
                result = resp.json().get("result")
                if result:
                    return json.loads(result)
    except Exception:
        pass  # Cache miss on error (fail open)

    return None


async def set_cached_response(model: str, messages: list[dict], response: dict) -> None:
    """
    Store a response in Redis with TTL. Uses 1 Redis command (SET with EX).
    Only caches non-streaming, successful responses.
    """
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return

    key = _build_cache_key(model, messages)
    value = json.dumps(response)

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{settings.upstash_redis_url}",
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=["SET", key, value, "EX", CACHE_TTL],
            )
    except Exception:
        pass  # Non-critical — silently ignore
