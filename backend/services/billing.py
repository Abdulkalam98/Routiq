import razorpay
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings

logger = logging.getLogger(__name__)

PLANS = {
    "free": {
        "name": "Free",
        "amount": 0,
        "tokens_per_month": 100_000,
        "models": ["gpt-4o-mini", "gemini-flash", "mistral-small"],
        "razorpay_plan_id": None,
    },
    "starter": {
        "name": "Starter",
        "amount": 99900,  # paise
        "tokens_per_month": 2_000_000,
        "models": "all",
        "razorpay_plan_id": None,  # set from env or create on first run
    },
    "pro": {
        "name": "Pro",
        "amount": 299900,  # paise
        "tokens_per_month": 20_000_000,
        "models": "all",
        "razorpay_plan_id": None,
    },
}


def get_razorpay_client() -> razorpay.Client:
    """Returns a configured Razorpay client instance."""
    settings = get_settings()
    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    return client


async def create_subscription(customer_id: str, plan: str, db: AsyncSession) -> dict:
    """
    Creates a Razorpay subscription for a customer.

    Args:
        customer_id: Internal customer ID.
        plan: Plan key ("starter" or "pro").
        db: Database session.

    Returns:
        Dictionary with subscription_id and short_url for payment.

    Raises:
        ValueError: If plan is invalid or free.
    """
    from models.customer import Customer

    if plan not in PLANS or plan == "free":
        raise ValueError(f"Invalid plan for subscription: {plan}")

    plan_config = PLANS[plan]

    # Get customer from database
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise ValueError(f"Customer not found: {customer_id}")

    client = get_razorpay_client()

    # Ensure Razorpay customer exists
    if not customer.razorpay_customer_id:
        rz_customer = client.customer.create({
            "name": customer.name or customer.email,
            "email": customer.email,
        })
        customer.razorpay_customer_id = rz_customer["id"]
        await db.commit()

    # Get or create Razorpay plan
    razorpay_plan_id = plan_config["razorpay_plan_id"]
    if not razorpay_plan_id:
        razorpay_plan_id = _get_or_create_razorpay_plan(plan, plan_config)
        PLANS[plan]["razorpay_plan_id"] = razorpay_plan_id

    # Create subscription
    subscription_data = {
        "plan_id": razorpay_plan_id,
        "customer_id": customer.razorpay_customer_id,
        "total_count": 12,  # 12 billing cycles
        "quantity": 1,
    }

    subscription = client.subscription.create(subscription_data)

    logger.info(
        f"Created subscription {subscription['id']} for customer {customer_id} on plan {plan}"
    )

    return {
        "subscription_id": subscription["id"],
        "short_url": subscription.get("short_url", ""),
        "status": subscription.get("status", "created"),
    }


async def cancel_subscription(subscription_id: str) -> dict:
    """
    Cancels a Razorpay subscription.

    Args:
        subscription_id: Razorpay subscription ID.

    Returns:
        Cancellation response from Razorpay.
    """
    client = get_razorpay_client()
    result = client.subscription.cancel(subscription_id, {"cancel_at_cycle_end": 1})
    logger.info(f"Cancelled subscription {subscription_id}")
    return result


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verifies the Razorpay webhook signature using HMAC SHA256.

    Args:
        payload: Raw request body bytes.
        signature: Value from X-Razorpay-Signature header.

    Returns:
        True if signature is valid, False otherwise.
    """
    settings = get_settings()
    secret = settings.razorpay_webhook_secret

    if not secret:
        logger.error("Razorpay webhook secret not configured")
        return False

    expected_signature = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature)


async def handle_webhook_event(event_type: str, payload: dict, db: AsyncSession) -> None:
    """
    Processes incoming Razorpay webhook events.

    Args:
        event_type: The event type string (e.g., "subscription.activated").
        payload: The full webhook payload.
        db: Database session.
    """
    from models.customer import Customer
    from models.payment import Payment

    entity = payload.get("payload", {})

    if event_type == "subscription.activated":
        subscription = entity.get("subscription", {}).get("entity", {})
        razorpay_customer_id = subscription.get("customer_id")
        plan_id = subscription.get("plan_id")

        plan_name = _plan_name_from_razorpay_id(plan_id)
        if not plan_name:
            logger.warning(f"Unknown Razorpay plan_id: {plan_id}")
            return

        result = await db.execute(
            select(Customer).where(Customer.razorpay_customer_id == razorpay_customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer.plan = plan_name
            customer.subscription_id = subscription.get("id")
            await db.commit()
            logger.info(f"Customer {customer.id} upgraded to {plan_name}")
        else:
            logger.warning(f"Customer not found for razorpay_customer_id: {razorpay_customer_id}")

    elif event_type == "subscription.charged":
        payment_entity = entity.get("payment", {}).get("entity", {})
        subscription = entity.get("subscription", {}).get("entity", {})
        razorpay_customer_id = payment_entity.get("customer_id") or subscription.get("customer_id")

        result = await db.execute(
            select(Customer).where(Customer.razorpay_customer_id == razorpay_customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            # Log payment
            payment = Payment(
                customer_id=customer.id,
                razorpay_payment_id=payment_entity.get("id"),
                razorpay_subscription_id=subscription.get("id"),
                amount=payment_entity.get("amount", 0),
                currency=payment_entity.get("currency", "INR"),
                status="captured",
                created_at=datetime.now(timezone.utc),
            )
            db.add(payment)

            # Ensure plan is active
            plan_id = subscription.get("plan_id")
            plan_name = _plan_name_from_razorpay_id(plan_id)
            if plan_name and customer.plan != plan_name:
                customer.plan = plan_name

            await db.commit()
            logger.info(
                f"Payment {payment_entity.get('id')} recorded for customer {customer.id}"
            )
        else:
            logger.warning(
                f"Customer not found for razorpay_customer_id: {razorpay_customer_id}"
            )

    elif event_type == "subscription.cancelled":
        subscription = entity.get("subscription", {}).get("entity", {})
        razorpay_customer_id = subscription.get("customer_id")

        result = await db.execute(
            select(Customer).where(Customer.razorpay_customer_id == razorpay_customer_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            customer.plan = "free"
            customer.subscription_id = None
            await db.commit()
            logger.info(f"Customer {customer.id} downgraded to free (subscription cancelled)")
        else:
            logger.warning(
                f"Customer not found for razorpay_customer_id: {razorpay_customer_id}"
            )

    elif event_type == "payment.failed":
        payment_entity = entity.get("payment", {}).get("entity", {})
        razorpay_customer_id = payment_entity.get("customer_id")
        error_description = payment_entity.get("error_description", "Unknown error")

        logger.error(
            f"Payment failed for razorpay_customer_id {razorpay_customer_id}: "
            f"{error_description}"
        )
        # TODO: Send notification to customer

    else:
        logger.info(f"Unhandled webhook event: {event_type}")


async def get_customer_usage_this_month(customer_id: str, db: AsyncSession) -> int:
    """
    Query total tokens used by the customer this month.

    Args:
        customer_id: Internal customer ID.
        db: Database session.

    Returns:
        Total tokens (prompt + completion) used this month.
    """
    from models.usage_log import UsageLog

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(UsageLog.prompt_tokens + UsageLog.completion_tokens), 0
            )
        ).where(
            UsageLog.customer_id == customer_id,
            UsageLog.created_at >= month_start,
        )
    )

    return result.scalar_one()


async def check_token_limit(customer_id: str, plan: str, db: AsyncSession) -> bool:
    """
    Checks if a customer is within their plan's token limit.

    Args:
        customer_id: Internal customer ID.
        plan: Plan key.
        db: Database session.

    Returns:
        True if customer has tokens remaining, False if limit exceeded.
    """
    if plan not in PLANS:
        return False

    plan_config = PLANS[plan]
    tokens_used = await get_customer_usage_this_month(customer_id, db)

    return tokens_used < plan_config["tokens_per_month"]


# --- Private helpers ---


def _get_or_create_razorpay_plan(plan_key: str, plan_config: dict) -> str:
    """Creates a Razorpay plan or retrieves an existing one."""
    settings = get_settings()

    # Check if plan ID is in environment
    env_plan_id = getattr(settings, f"razorpay_plan_id_{plan_key}", None)
    if env_plan_id:
        return env_plan_id

    client = get_razorpay_client()

    plan_data = {
        "period": "monthly",
        "interval": 1,
        "item": {
            "name": f"Routiq {plan_config['name']}",
            "amount": plan_config["amount"],
            "currency": "INR",
            "description": f"Routiq {plan_config['name']} - {plan_config['tokens_per_month']:,} tokens/month",
        },
    }

    rz_plan = client.plan.create(plan_data)
    logger.info(f"Created Razorpay plan for {plan_key}: {rz_plan['id']}")
    return rz_plan["id"]


def _plan_name_from_razorpay_id(razorpay_plan_id: Optional[str]) -> Optional[str]:
    """Resolve internal plan name from Razorpay plan ID."""
    if not razorpay_plan_id:
        return None

    for plan_key, plan_config in PLANS.items():
        if plan_config.get("razorpay_plan_id") == razorpay_plan_id:
            return plan_key

    return None
