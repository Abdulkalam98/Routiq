"""
Dashboard analytics router - GET /dashboard/stats, cost-by-model, requests
JWT-authenticated endpoints for real-time usage data.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
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


def _start_of_today() -> datetime:
    """Get the start of today in UTC."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_month() -> datetime:
    """Get the start of the current month in UTC."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/stats")
async def dashboard_stats(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """
    Get aggregated stats: today's spend, today's requests, this month's requests.
    """
    customer_id = user["customer_id"]
    today = _start_of_today()
    month_start = _start_of_month()

    # Today's spend (sum of cost_inr)
    spend_result = await session.execute(
        select(func.coalesce(func.sum(UsageLog.cost_inr), 0.0)).where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= today,
        )
    )
    total_spend_today = round(float(spend_result.scalar_one()), 2)

    # Today's request count
    today_count_result = await session.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= today,
        )
    )
    total_requests_today = int(today_count_result.scalar_one())

    # This month's request count
    month_count_result = await session.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= month_start,
        )
    )
    total_requests_month = int(month_count_result.scalar_one())

    return {
        "total_spend_today": total_spend_today,
        "total_requests_today": total_requests_today,
        "total_requests_month": total_requests_month,
    }


@router.get("/cost-by-model")
async def dashboard_cost_by_model(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """
    Get cost breakdown by model for the current month.
    """
    customer_id = user["customer_id"]
    month_start = _start_of_month()

    result = await session.execute(
        select(
            UsageLog.model,
            func.sum(UsageLog.cost_inr).label("cost"),
        )
        .where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= month_start,
        )
        .group_by(UsageLog.model)
        .order_by(func.sum(UsageLog.cost_inr).desc())
    )
    rows = result.all()

    return [
        {"model": row.model, "cost": round(float(row.cost), 2)}
        for row in rows
    ]


@router.get("/requests")
async def dashboard_requests(
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
):
    """
    Get recent requests with model, tokens, cost, latency, and relative time.
    """
    customer_id = user["customer_id"]

    result = await session.execute(
        select(UsageLog)
        .where(UsageLog.customer_id == customer_id)
        .order_by(UsageLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "model": log.model,
            "tokens": (log.prompt_tokens or 0) + (log.completion_tokens or 0),
            "cost": round(float(log.cost_inr or 0), 4),
            "latency": f"{log.latency_ms or 0}ms",
            "time": _relative_time(log.created_at) if log.created_at else "unknown",
        }
        for log in logs
    ]
