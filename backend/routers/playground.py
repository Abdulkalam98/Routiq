"""
Playground chat router - POST /playground/chat
JWT-authenticated chat endpoint for in-dashboard testing.
Supports smart auto-routing and response caching.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.keys import get_current_user_jwt
from services.router import get_provider, get_provider_smart
from services.cost import calculate_cost
from services.usage import log_usage
from services.cache import get_cached_response, set_cached_response
from services.semantic_cache import find_similar_cached, store_semantic_cache
from services.context_window import trim_messages, get_tokens_saved
from services.summarizer import summarize_turns, build_summary_message
from middleware.prompt_guard import check_prompt_injection, format_block_response
from services.pii_redactor import redact_messages

logger = logging.getLogger("routiq.playground")

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
    cached: bool = False
    cache_type: str | None = None  # "exact" or "semantic"
    tokens_saved: int = 0


@router.post("/chat", response_model=PlaygroundChatResponse)
async def playground_chat(
    body: PlaygroundChatRequest,
    user: dict = Depends(get_current_user_jwt),
    session: AsyncSession = Depends(get_db),
):
    """
    Chat endpoint for the playground. Uses JWT auth (not API key).
    Sends messages to the selected model and returns response with cost info.
    Supports smart auto-routing and exact-match caching.
    """
    # Convert messages to list of dicts for the provider
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # --- Security checks (injection + PII, no token budget for playground) ---

    # Prompt injection detection
    injection_result = check_prompt_injection(messages)
    if injection_result.action == "block":
        logger.warning(
            "Playground injection blocked | score=%d patterns=%s",
            injection_result.score,
            injection_result.matched_patterns,
        )
        raise HTTPException(
            status_code=400,
            detail=format_block_response(injection_result),
        )

    # PII redaction
    redacted_messages, pii_report = redact_messages(messages)
    if pii_report.total > 0:
        messages = redacted_messages

    # --- End security checks ---

    # Resolve provider (smart routing for "auto")
    try:
        if body.model == "auto":
            provider, resolved_model, actual_model = get_provider_smart(messages)
        else:
            provider, resolved_model = get_provider(body.model)
            actual_model = body.model
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

    # Check cache (use actual_model for accurate cache keys)
    cached = await get_cached_response(actual_model, messages)
    if cached:
        return PlaygroundChatResponse(
            content=cached["content"],
            model=cached.get("model", actual_model),
            usage=UsageInfo(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            cost_inr=0.0,
            cached=True,
            cache_type="exact",
        )

    # Semantic cache check
    semantic_hit = await find_similar_cached(messages, actual_model)
    if semantic_hit:
        return PlaygroundChatResponse(
            content=semantic_hit["content"],
            model=semantic_hit.get("model", actual_model),
            usage=UsageInfo(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            cost_inr=0.0,
            cached=True,
            cache_type="semantic",
        )

    # Context window trimming + summarization
    messages_to_send = messages
    tokens_saved = 0
    trimmed_messages, was_trimmed, dropped = trim_messages(messages)
    if was_trimmed:
        tokens_saved = get_tokens_saved(messages, trimmed_messages)
        summary = await summarize_turns(dropped)
        if summary:
            summary_msg = build_summary_message(summary)
            if trimmed_messages and trimmed_messages[0].get("role") == "system":
                messages_to_send = [trimmed_messages[0], summary_msg] + trimmed_messages[1:]
            else:
                messages_to_send = [summary_msg] + trimmed_messages
        else:
            messages_to_send = trimmed_messages

    # Call provider
    try:
        result = await provider.chat_completion(
            model=resolved_model,
            messages=messages_to_send,
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
    model_used = result.get("model", actual_model)

    # Calculate cost using actual_model
    try:
        cost_usd, cost_inr = calculate_cost(actual_model, prompt_tokens, completion_tokens)
    except ValueError:
        cost_usd, cost_inr = 0.0, 0.0

    # Cache the response for future identical requests
    asyncio.create_task(
        set_cached_response(actual_model, messages, {
            "content": content,
            "model": model_used,
        })
    )

    # Store in semantic cache for similar requests
    asyncio.create_task(
        store_semantic_cache(messages, actual_model, content)
    )

    # Log usage asynchronously
    asyncio.create_task(
        log_usage(
            customer_id=user["customer_id"],
            model=actual_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            cost_inr=cost_inr,
        )
    )

    return PlaygroundChatResponse(
        content=content,
        model=model_used,
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        ),
        cost_inr=round(cost_inr, 4),
        cached=False,
        tokens_saved=tokens_saved,
    )
