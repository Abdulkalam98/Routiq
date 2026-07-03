"""
Token budget enforcement per API key.

Tracks daily token consumption in Upstash Redis and blocks requests
when the budget is exceeded. Resets daily at midnight UTC via TTL.
Fails open if Redis is unavailable.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from middleware.ratelimit import redis_client

# Daily token budgets per plan (prompt_tokens + completion_tokens)
TOKEN_BUDGETS = {
    "free": 50_000,
    "starter": 200_000,
    "pro": 1_000_000,
}


def _budget_key(api_key_id: str) -> str:
    """Redis key for daily token budget tracking."""
    return f"budget:{api_key_id}:daily"


def _seconds_until_midnight_utc() -> int:
    """Seconds remaining until next UTC midnight (for TTL)."""
    now = datetime.now(timezone.utc)
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return int((next_midnight - now).total_seconds())


async def check_token_budget(request: Request, customer) -> None:
    """
    Check if the API key has remaining daily token budget.

    Must be called AFTER auth middleware (needs request.state.api_key_id).
    Raises HTTPException(429) if budget exceeded.
    Fails open on Redis errors (allows request through).
    """
    api_key_id = getattr(request.state, "api_key_id", None)
    if not api_key_id:
        return  # Can't enforce without key ID — fail open

    plan = getattr(customer, "plan", None) or "free"
    budget = TOKEN_BUDGETS.get(plan, TOKEN_BUDGETS["free"])

    key = _budget_key(api_key_id)

    try:
        result = await redis_client.execute("GET", key)
        used = int(result) if result else 0
    except Exception:
        return  # Redis down → fail open

    if used >= budget:
        ttl = _seconds_until_midnight_utc()
        raise HTTPException(
            status_code=429,
            detail={
                "error": {
                    "message": (
                        f"Daily token budget exceeded ({budget:,} tokens/day on {plan} plan). "
                        f"Resets at midnight UTC. Upgrade at routiq.io/billing"
                    ),
                    "type": "token_budget_error",
                    "code": "token_budget_exceeded",
                }
            },
            headers={"Retry-After": str(ttl)},
        )

    # Store budget info on request for optional response headers
    request.state.token_budget_remaining = budget - used
    request.state.token_budget_limit = budget


async def increment_token_budget(api_key_id: str, total_tokens: int) -> None:
    """
    Increment token usage counter after a request completes.

    Called as fire-and-forget via asyncio.create_task().
    Sets TTL to seconds-until-midnight for automatic daily reset.
    """
    if not api_key_id or total_tokens <= 0:
        return

    key = _budget_key(api_key_id)
    ttl = _seconds_until_midnight_utc()

    try:
        await redis_client.pipeline([
            ["INCRBY", key, str(total_tokens)],
            ["EXPIRE", key, str(ttl)],
        ])
    except Exception:
        pass  # Non-critical — fail silently
