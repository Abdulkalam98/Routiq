import time
import httpx
from fastapi import Depends, HTTPException, Request
from config import get_settings

settings = get_settings()

RATE_LIMITS = {
    "free": {"per_minute": 10, "per_day": 100},
    "starter": {"per_minute": 60, "per_day": 10_000},
    "pro": {"per_minute": 300, "per_day": 0},  # 0 = unlimited
}


class UpstashRedis:
    """Lightweight Upstash Redis client using REST API (no redis-py needed for free tier)."""

    def __init__(self):
        self.url = settings.upstash_redis_url
        self.token = settings.upstash_redis_token
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.url,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5.0,
            )
        return self._client

    async def execute(self, *args):
        """Execute a Redis command via Upstash REST API."""
        response = await self.client.post("/", json=list(args))
        if response.status_code == 200:
            return response.json().get("result")
        return None

    async def pipeline(self, commands: list):
        """Execute multiple commands in a pipeline."""
        response = await self.client.post("/pipeline", json=commands)
        if response.status_code == 200:
            return [r.get("result") for r in response.json()]
        return []


redis_client = UpstashRedis()


async def check_rate_limit(request: Request, customer=None):
    """Check rate limits using Upstash Redis sliding window."""
    if customer is None:
        from middleware.auth import get_current_customer
        # This should be called after auth
        return

    plan = customer.plan or "free"
    limits = RATE_LIMITS.get(plan, RATE_LIMITS["free"])
    customer_id = str(customer.id)
    now = time.time()

    # Sliding window keys
    minute_key = f"rl:{customer_id}:min"
    day_key = f"rl:{customer_id}:day"

    # Use pipeline for efficiency (counts as fewer commands on Upstash free tier)
    now_ms = str(now)
    minute_ago = str(now - 60)
    day_ago = str(now - 86400)

    try:
        # Remove old entries and count current window
        results = await redis_client.pipeline([
            ["ZREMRANGEBYSCORE", minute_key, "0", minute_ago],
            ["ZREMRANGEBYSCORE", day_key, "0", day_ago],
            ["ZCARD", minute_key],
            ["ZCARD", day_key],
            ["ZADD", minute_key, now_ms, f"{now_ms}:{customer_id}"],
            ["ZADD", day_key, now_ms, f"{now_ms}:{customer_id}"],
            ["EXPIRE", minute_key, "120"],
            ["EXPIRE", day_key, "90000"],
        ])

        minute_count = results[2] if results else 0
        day_count = results[3] if results else 0

    except Exception:
        # If Redis is down, allow the request (fail open)
        return customer

    # Check per-minute limit
    if minute_count >= limits["per_minute"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": {
                    "message": f"Rate limit exceeded ({limits['per_minute']} req/min). Upgrade at routiq.io/billing",
                    "type": "rate_limit_error",
                    "code": "rate_limit_exceeded",
                }
            },
            headers={"Retry-After": "60"},
        )

    # Check per-day limit (0 = unlimited)
    if limits["per_day"] > 0 and day_count >= limits["per_day"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": {
                    "message": f"Daily limit exceeded ({limits['per_day']} req/day). Upgrade at routiq.io/billing",
                    "type": "rate_limit_error",
                    "code": "daily_limit_exceeded",
                }
            },
            headers={"Retry-After": "3600"},
        )

    # Store rate limit info on request for headers
    request.state.rate_limit_remaining = limits["per_minute"] - minute_count - 1
    request.state.rate_limit_limit = limits["per_minute"]

    return customer
