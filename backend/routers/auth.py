"""
Auth router - POST /auth/signup, POST /auth/login
Issues JWT tokens for dashboard users.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _make_jwt(customer_id: str, email: str) -> str:
    settings = get_settings()
    payload = {
        "sub": customer_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@router.post("/signup", response_model=TokenResponse)
async def signup(body: SignupRequest, session: AsyncSession = Depends(get_db)):
    from models.customer import Customer

    result = await session.execute(
        select(Customer).where(Customer.email == body.email)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "message": "Email already registered.",
                    "type": "invalid_request_error",
                    "code": "email_taken",
                }
            },
        )

    password_hash = bcrypt.hashpw(
        body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    customer = Customer(
        name=body.name,
        email=body.email,
        password_hash=password_hash,
        plan="free",
    )
    session.add(customer)
    await session.commit()
    await session.refresh(customer)

    return TokenResponse(access_token=_make_jwt(str(customer.id), customer.email))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_db)):
    from models.customer import Customer

    result = await session.execute(
        select(Customer).where(Customer.email == body.email)
    )
    customer = result.scalar_one_or_none()

    if customer is None or not customer.password_hash:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid email or password.",
                    "type": "authentication_error",
                    "code": "invalid_credentials",
                }
            },
        )

    if not bcrypt.checkpw(body.password.encode("utf-8"), customer.password_hash.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "message": "Invalid email or password.",
                    "type": "authentication_error",
                    "code": "invalid_credentials",
                }
            },
        )

    return TokenResponse(access_token=_make_jwt(str(customer.id), customer.email))
