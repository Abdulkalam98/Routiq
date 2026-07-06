"""Async usage logging - never blocks the response."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import insert
from database import AsyncSessionLocal
from models.usage import UsageLog


async def log_usage(
    customer_id,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    cost_inr: float,
    completion_id: str = "",
    api_key_id=None,
    provider: str = "",
    latency_ms: int = 0,
    status: str = "success",
    cache_type: str | None = None,
    error_message: str | None = None,
    is_stream: bool = False,
    key_source: str = "platform",
):
    """Log usage to database asynchronously. Failures are silently ignored."""
    try:
        async with AsyncSessionLocal() as session:
            usage = UsageLog(
                id=uuid.uuid4(),
                customer_id=customer_id,
                api_key_id=api_key_id,
                model=model,
                provider=provider,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_usd=cost_usd,
                cost_inr=cost_inr,
                latency_ms=latency_ms,
                status=status,
                cache_type=cache_type,
                completion_id=completion_id or None,
                error_message=error_message[:200] if error_message else None,
                is_stream=is_stream,
                key_source=key_source,
            )
            session.add(usage)
            await session.commit()
    except Exception:
        # Never crash the request for logging failures
        pass
