"""
Playground chat router - POST /playground/chat
JWT-authenticated chat endpoint for in-dashboard testing.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.keys import get_current_user_jwt
from services.router import get_provider
from services.cost import calculate_cost
from services.usage import log_usage

router = APIRouter(prefix="/playground", tags=["Playground"])


class MessageItem(BaseModel):
    role: str
    content: str


class PlaygroundChatRequest(BaseModel):
    model: str
    messages: list[MessageItem]


class UsageInfo(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class PlaygroundChatResponse(BaseModel):
    content: str
    model: str
    usage: UsageInfo
    cost_inr: float


@router.post("/chat", response_model=PlaygroundChatResponse)
async def playground_chat(
    body: PlaygroundChatRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """
    Chat endpoint for the playground. Uses JWT auth (not API key).
    Sends messages to the selected model and returns response with cost info.
    """
    # Resolve provider
    try:
        provider, resolved_model = get_provider(body.model)
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "message": str(e),
                    "type": "invalid_request_error",
                    "code": "model_not_found",
                }
            },
        )

    # Convert messages to list of dicts for the provider
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # Call provider
    try:
        result = await provider.chat_completion(
            model=resolved_model,
            messages=messages,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "message": "Provider temporarily unavailable. Please try again.",
                    "type": "server_error",
                    "code": "provider_error",
                }
            },
        )

    # Extract response data
    choices = result.get("choices", [])
    choice = choices[0] if choices else {}
    content = choice.get("message", {}).get("content", "")
    usage_data = result.get("usage", {})
    prompt_tokens = usage_data.get("prompt_tokens", 0)
    completion_tokens = usage_data.get("completion_tokens", 0)
    total_tokens = usage_data.get("total_tokens", prompt_tokens + completion_tokens)

    # Calculate cost
    try:
        cost_usd, cost_inr = calculate_cost(body.model, prompt_tokens, completion_tokens)
    except ValueError:
        cost_usd, cost_inr = 0.0, 0.0

    # Log usage asynchronously
    asyncio.create_task(
        log_usage(
            customer_id=user["customer_id"],
            model=body.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            cost_inr=cost_inr,
        )
    )

    return PlaygroundChatResponse(
        content=content,
        model=result.get("model", body.model),
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        ),
        cost_inr=round(cost_inr, 4),
    )
