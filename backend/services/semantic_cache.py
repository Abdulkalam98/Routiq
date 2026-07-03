"""
Semantic caching — uses Google text-embedding-004 to find similar cached responses.
Falls back gracefully if embedding API fails (fail-open).

Storage: Rotating buffer of 500 entries in Upstash Redis.
Key format: scache:{0-499} → JSON {embedding, model, content, created_at}
Index key: scache:idx → current write position
"""

import hashlib
import json
import math
import time
from typing import Optional

import httpx

from config import get_settings

SEMANTIC_CACHE_SIZE = 500
SIMILARITY_THRESHOLD = 0.92
EMBEDDING_MODEL = "text-embedding-004"


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _extract_query(messages: list[dict]) -> str:
    """Extract the semantic query from messages (last user message + model context)."""
    last_user = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user = msg.get("content", "")
            break
    return last_user[:500]  # Cap at 500 chars for embedding


async def embed_text(text: str) -> Optional[list[float]]:
    """
    Generate embedding using Google's text-embedding-004 model.
    Returns None on failure (fail-open).
    """
    settings = get_settings()
    if not settings.google_api_key or not text.strip():
        return None

    url = (
        f"https://generativelanguage.googleapis.com/v1/models/"
        f"{EMBEDDING_MODEL}:embedContent?key={settings.google_api_key}"
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                url,
                json={"model": f"models/{EMBEDDING_MODEL}", "content": {"parts": [{"text": text}]}},
            )
            if resp.status_code == 200:
                data = resp.json()
                values = data.get("embedding", {}).get("values", [])
                if values:
                    return values
    except Exception:
        pass

    return None


async def _redis_get(key: str) -> Optional[str]:
    """GET a single key from Upstash Redis."""
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                settings.upstash_redis_url,
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=["GET", key],
            )
            if resp.status_code == 200:
                return resp.json().get("result")
    except Exception:
        pass
    return None


async def _redis_set(key: str, value: str, ttl: int = 7200) -> None:
    """SET a key in Upstash Redis with TTL."""
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                settings.upstash_redis_url,
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=["SET", key, value, "EX", ttl],
            )
    except Exception:
        pass


async def _redis_pipeline(commands: list) -> Optional[list]:
    """Execute multiple commands in a pipeline."""
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.upstash_redis_url}/pipeline",
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=commands,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


async def find_similar_cached(
    messages: list[dict], model: str
) -> Optional[dict]:
    """
    Find a semantically similar cached response.
    Returns {content, model} or None.

    Flow:
    1. Extract last user message
    2. Generate embedding
    3. Scan recent cache entries for similarity > threshold
    4. Return best match if found
    """
    query = _extract_query(messages)
    if not query:
        return None

    embedding = await embed_text(query)
    if not embedding:
        return None

    # Get current index to know which slots to scan
    idx_str = await _redis_get("scache:idx")
    if idx_str is None:
        return None

    try:
        current_idx = int(idx_str)
    except (ValueError, TypeError):
        return None

    # Scan last 50 entries (balance between hit rate and Redis commands)
    # Use pipeline to fetch in batches
    scan_count = min(50, SEMANTIC_CACHE_SIZE)
    keys = []
    for i in range(scan_count):
        slot = (current_idx - 1 - i) % SEMANTIC_CACHE_SIZE
        keys.append(f"scache:{slot}")

    commands = [["GET", k] for k in keys]
    results = await _redis_pipeline(commands)
    if not results:
        return None

    best_score = 0.0
    best_entry = None

    for result in results:
        raw = result.get("result") if isinstance(result, dict) else None
        if not raw:
            continue
        try:
            entry = json.loads(raw)
            entry_embedding = entry.get("embedding")
            if not entry_embedding:
                continue

            score = _cosine_similarity(embedding, entry_embedding)
            if score > best_score and score >= SIMILARITY_THRESHOLD:
                best_score = score
                best_entry = entry
        except (json.JSONDecodeError, TypeError):
            continue

    if best_entry:
        return {
            "content": best_entry["content"],
            "model": best_entry.get("model", model),
            "similarity": best_score,
        }

    return None


async def store_semantic_cache(
    messages: list[dict], model: str, response_content: str
) -> None:
    """
    Store a response with its embedding for future semantic matching.
    Uses a rotating buffer (ring buffer) of SEMANTIC_CACHE_SIZE entries.
    """
    query = _extract_query(messages)
    if not query or not response_content:
        return

    embedding = await embed_text(query)
    if not embedding:
        return

    # Get and increment index atomically
    settings = get_settings()
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return

    try:
        # INCR to get next slot, wrap around
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                settings.upstash_redis_url,
                headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                json=["INCR", "scache:idx"],
            )
            if resp.status_code != 200:
                return
            idx = int(resp.json().get("result", 0)) % SEMANTIC_CACHE_SIZE

        # Store the entry
        entry = json.dumps({
            "embedding": embedding,
            "model": model,
            "content": response_content,
            "query": query[:200],  # Store truncated query for debugging
            "created_at": int(time.time()),
        })

        await _redis_set(f"scache:{idx}", entry, ttl=7200)  # 2hr TTL

    except Exception:
        pass  # Fail-open
