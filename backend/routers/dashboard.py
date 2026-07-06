"""
Dashboard analytics router - GET /dashboard/stats, cost-by-model, requests, logs
JWT-authenticated endpoints for real-time usage data.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.keys import get_current_user_jwt
from models.usage import UsageLog

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _relative_time(dt: datetime) -> str:
    """Convert a datetime to a human-friendly relative time string."""
    now = datetime.now(timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return f"{seconds} sec ago"
    if seconds < 3600:
        return f"{seconds // 60} min ago"
    if seconds < 86400:
        return f"{seconds // 3600} hr ago"
    return f"{seconds // 86400} days ago"


def _get_range_start(range_value: str) -> datetime:
    """Convert range query param to a UTC datetime."""
    now = datetime.now(timezone.utc)
    if range_value == "24h":
        return now - timedelta(hours=24)
    elif range_value == "7d":
        return now - timedelta(days=7)
    elif range_value == "30d":
        return now - timedelta(days=30)
    elif range_value == "90d":
        return now - timedelta(days=90)
    else:
        # Default to 30 days
        return now - timedelta(days=30)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/stats")
async def dashboard_stats(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
    range: str = Query(default="30d", alias="range"),
):
    """
    Get aggregated stats for the given time range.
    Returns: total_spend, total_tokens, total_requests, cache_hit_rate, avg per day.
    """
    customer_id = user["customer_id"]
    range_start = _get_range_start(range)
    days_in_range = max((datetime.now(timezone.utc) - range_start).days, 1)

    # Aggregate query — single round trip
    result = await session.execute(
        select(
            func.coalesce(func.sum(UsageLog.cost_inr), 0.0).label("total_spend"),
            func.coalesce(
                func.sum(UsageLog.prompt_tokens + UsageLog.completion_tokens), 0
            ).label("total_tokens"),
            func.count(UsageLog.id).label("total_requests"),
            func.count(
                case((UsageLog.status == "cached", UsageLog.id))
            ).label("cache_hits"),
        ).where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= range_start,
        )
    )
    row = result.one()

    total_spend = round(float(row.total_spend), 2)
    total_tokens = int(row.total_tokens)
    total_requests = int(row.total_requests)
    cache_hits = int(row.cache_hits)
    cache_hit_rate = round((cache_hits / total_requests * 100), 1) if total_requests > 0 else 0.0

    return {
        "total_spend_today": total_spend,
        "total_tokens": total_tokens,
        "total_requests_today": total_requests,
        "total_requests_month": total_requests,
        "cache_hit_rate": cache_hit_rate,
        "avg_spend_per_day": round(total_spend / days_in_range, 2),
        "avg_tokens_per_day": round(total_tokens / days_in_range),
    }


@router.get("/cost-by-model")
async def dashboard_cost_by_model(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
    range: str = Query(default="30d", alias="range"),
):
    """
    Get cost/tokens/requests breakdown by model for the given time range.
    """
    customer_id = user["customer_id"]
    range_start = _get_range_start(range)

    result = await session.execute(
        select(
            UsageLog.model,
            func.sum(UsageLog.cost_inr).label("cost"),
            func.sum(UsageLog.prompt_tokens + UsageLog.completion_tokens).label("tokens"),
            func.count(UsageLog.id).label("requests"),
        )
        .where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= range_start,
        )
        .group_by(UsageLog.model)
        .order_by(func.sum(UsageLog.cost_inr).desc())
    )
    rows = result.all()

    return [
        {
            "model": row.model,
            "cost": round(float(row.cost), 2),
            "tokens": int(row.tokens),
            "requests": int(row.requests),
        }
        for row in rows
    ]


@router.get("/requests")
async def dashboard_requests(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
    range: str = Query(default="30d", alias="range"),
):
    """
    Get recent requests with model, tokens, cost, latency, status, and relative time.
    """
    customer_id = user["customer_id"]
    range_start = _get_range_start(range)

    result = await session.execute(
        select(UsageLog)
        .where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= range_start,
        )
        .order_by(UsageLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "model": log.model,
            "tokens": (log.prompt_tokens or 0) + (log.completion_tokens or 0),
            "prompt_tokens": log.prompt_tokens or 0,
            "completion_tokens": log.completion_tokens or 0,
            "cost": round(float(log.cost_inr or 0), 4),
            "latency": f"{log.latency_ms or 0}ms",
            "latency_ms": log.latency_ms or 0,
            "status": getattr(log, "status", "success") or "success",
            "cache_type": getattr(log, "cache_type", None),
            "is_stream": getattr(log, "is_stream", False),
            "time": _relative_time(log.created_at) if log.created_at else "unknown",
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


# ---------------------------------------------------------------------------
# Full Logs endpoint — filterable, paginated
# ---------------------------------------------------------------------------


@router.get("/logs")
async def dashboard_logs(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    model: str | None = Query(default=None),
    status: str | None = Query(default=None),
    range: str = Query(default="7d", alias="range"),
    search: str | None = Query(default=None),
):
    """
    Full request logs with filtering and pagination.
    Supports filtering by model, status, time range.
    """
    customer_id = user["customer_id"]
    range_start = _get_range_start(range)

    # Build query
    query = (
        select(UsageLog)
        .where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= range_start,
        )
    )

    # Apply filters
    if model:
        query = query.where(UsageLog.model == model)
    if status:
        query = query.where(UsageLog.status == status)

    # Count total (for pagination)
    count_query = (
        select(func.count(UsageLog.id))
        .where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= range_start,
        )
    )
    if model:
        count_query = count_query.where(UsageLog.model == model)
    if status:
        count_query = count_query.where(UsageLog.status == status)

    count_result = await session.execute(count_query)
    total = int(count_result.scalar_one())

    # Fetch paginated results
    query = query.order_by(UsageLog.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": str(log.id),
                "completion_id": getattr(log, "completion_id", None),
                "model": log.model,
                "provider": log.provider or "",
                "prompt_tokens": log.prompt_tokens or 0,
                "completion_tokens": log.completion_tokens or 0,
                "total_tokens": (log.prompt_tokens or 0) + (log.completion_tokens or 0),
                "cost_inr": round(float(log.cost_inr or 0), 4),
                "latency_ms": log.latency_ms or 0,
                "status": getattr(log, "status", "success") or "success",
                "cache_type": getattr(log, "cache_type", None),
                "is_stream": getattr(log, "is_stream", False),
                "error_message": getattr(log, "error_message", None),
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "time_ago": _relative_time(log.created_at) if log.created_at else "unknown",
            }
            for log in logs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total,
    }
