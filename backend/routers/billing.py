import logging
from typing import Optional

from fastapi import APIRouter, Request, Header, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from config import get_settings
from services.billing import (
    PLANS,
    create_subscription,
    cancel_subscription,
    verify_webhook_signature,
    handle_webhook_event,
    get_customer_usage_this_month,
    check_token_limit,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Dependencies ---


async def get_db() -> AsyncSession:
    """Get database session. Import the actual session factory from your db module."""
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield session


async def get_current_customer(request: Request, db: AsyncSession = Depends(get_db)):
    """Extract and validate the current authenticated customer from the request."""
    from models.customer import Customer
    from middleware.auth import decode_token

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        customer_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


# --- Request / Response Models ---


class SubscribeRequest(BaseModel):
    plan: str


class SubscribeResponse(BaseModel):
    subscription_id: str
    short_url: str
    status: str


class BillingStatusResponse(BaseModel):
    plan: str
    plan_name: str
    tokens_per_month: int
    tokens_used: int
    tokens_remaining: int
    within_limit: bool
    models: object


class PaymentHistoryItem(BaseModel):
    payment_id: str
    amount: int
    currency: str
    status: str
    created_at: str


# --- Webhook Endpoint ---


@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive and process Razorpay webhook events.
    Verifies the signature and dispatches to the event handler.
    """
    body = await request.body()

    if not x_razorpay_signature:
        logger.warning("Webhook received without signature header")
        raise HTTPException(status_code=400, detail="Missing signature header")

    if not verify_webhook_signature(body, x_razorpay_signature):
        logger.warning("Webhook signature verification failed")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("event")
    if not event_type:
        raise HTTPException(status_code=400, detail="Missing event type")

    try:
        await handle_webhook_event(event_type, payload, db)
    except Exception as e:
        logger.exception(f"Error handling webhook event {event_type}: {e}")
        # Return 200 anyway to prevent Razorpay retries for processing errors
        return JSONResponse(
            status_code=200,
            content={"status": "error", "message": "Event received but processing failed"},
        )

    return JSONResponse(status_code=200, content={"status": "ok"})


# --- Billing Endpoints ---


@router.post("/billing/subscribe", response_model=SubscribeResponse)
async def subscribe(
    body: SubscribeRequest,
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a subscription for the authenticated user.
    Returns a Razorpay payment link to complete the subscription.
    """
    plan = body.plan.lower()

    if plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan}")

    if plan == "free":
        raise HTTPException(
            status_code=400, detail="Free plan does not require a subscription"
        )

    if customer.plan == plan:
        raise HTTPException(
            status_code=400, detail=f"Already subscribed to {plan} plan"
        )

    try:
        result = await create_subscription(str(customer.id), plan, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to create subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")

    return SubscribeResponse(
        subscription_id=result["subscription_id"],
        short_url=result["short_url"],
        status=result["status"],
    )


@router.get("/billing/status", response_model=BillingStatusResponse)
async def billing_status(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current plan and usage information for the authenticated user.
    """
    plan = customer.plan or "free"
    plan_config = PLANS.get(plan, PLANS["free"])

    tokens_used = await get_customer_usage_this_month(str(customer.id), db)
    tokens_per_month = plan_config["tokens_per_month"]
    tokens_remaining = max(0, tokens_per_month - tokens_used)
    within_limit = tokens_used < tokens_per_month

    return BillingStatusResponse(
        plan=plan,
        plan_name=plan_config["name"],
        tokens_per_month=tokens_per_month,
        tokens_used=tokens_used,
        tokens_remaining=tokens_remaining,
        within_limit=within_limit,
        models=plan_config["models"],
    )


@router.get("/billing/history")
async def payment_history(
    customer=Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """
    Get payment history for the authenticated user.
    """
    from models.payment import Payment

    result = await db.execute(
        select(Payment)
        .where(Payment.customer_id == customer.id)
        .order_by(desc(Payment.created_at))
        .limit(50)
    )
    payments = result.scalars().all()

    history = [
        PaymentHistoryItem(
            payment_id=p.razorpay_payment_id or str(p.id),
            amount=p.amount,
            currency=p.currency,
            status=p.status,
            created_at=p.created_at.isoformat() if p.created_at else "",
        )
        for p in payments
    ]

    return {"payments": history, "total": len(history)}
