"""
Chat completions router - OpenAI-compatible POST /chat/completions
"""

import asyncio
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from middleware.auth import get_current_customer
from middleware.ratelimit import check_rate_limit
from services.router import get_provider, get_fallback_provider
from services.cost import calculate_cost
from services.usage import log_usage

router = APIRouter(tags=["Chat"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    stop: str | list[str] | None = None
    user: str | None = None


class UsageInfo(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class MessageContent(BaseModel):
    role: str = "assistant"
    content: str | None = None


class Choice(BaseModel):
    index: int = 0
    message: MessageContent
    finish_reason: str | None = "stop"


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[Choice]
    usage: UsageInfo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_completion_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:29]}"


def _openai_error(message: str, error_type: str, code: str, status_code: int = 400):
    """Return an error response in OpenAI-compatible format."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": message,
                "type": error_type,
                "code": code,
            }
        },
    )


async def _build_streaming_response(
    provider,
    request_body: ChatCompletionRequest,
    completion_id: str,
    customer,
) -> AsyncGenerator[str, None]:
    """
    Yield SSE-formatted chunks from the provider's streaming response.
    After the stream ends, log usage asynchronously.
    """
    prompt_tokens = 0
    completion_tokens = 0
    full_content = ""

    try:
        async for chunk in provider.stream_chat_completion(
            model=request_body.model,
            messages=request_body.messages,
            temperature=request_body.temperature,
            max_tokens=request_body.max_tokens,
            top_p=request_body.top_p,
            frequency_penalty=request_body.frequency_penalty,
            presence_penalty=request_body.presence_penalty,
            stop=request_body.stop,
        ):
            # Each chunk is expected to be a dict with delta content and optional usage
            delta_content = chunk.get("content", "")
            finish_reason = chunk.get("finish_reason")

            if chunk.get("usage"):
                prompt_tokens = chunk["usage"].get("prompt_tokens", 0)
                completion_tokens = chunk["usage"].get("completion_tokens", 0)

            if delta_content:
                full_content += delta_content
                completion_tokens = max(
                    completion_tokens, len(full_content) // 4
                )  # Rough token estimate if not provided

            sse_data = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": request_body.model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": delta_content} if delta_content else {},
                        "finish_reason": finish_reason,
                    }
                ],
            }

            yield f"data: {_json_dumps(sse_data)}\n\n"

            if finish_reason:
                break

        # Final [DONE] marker per OpenAI spec
        yield "data: [DONE]\n\n"

    finally:
        # Log usage asynchronously after stream completes
        cost_usd, cost_inr = calculate_cost(
            request_body.model, prompt_tokens, completion_tokens
        )
        asyncio.create_task(
            log_usage(
                customer_id=customer.id,
                model=request_body.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_usd=cost_usd,
                cost_inr=cost_inr,
                completion_id=completion_id,
            )
        )


def _json_dumps(obj: dict) -> str:
    """Fast JSON serialization."""
    import json

    return json.dumps(obj, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/chat/completions")
async def chat_completions(
    request_body: ChatCompletionRequest,
    customer=Depends(get_current_customer),
    _rate_limit=Depends(check_rate_limit),
):
    """
    OpenAI-compatible chat completions endpoint.
    Supports both streaming and non-streaming responses.
    """
    completion_id = _generate_completion_id()
    created = int(time.time())

    # Resolve provider for requested model
    try:
        provider = get_provider(request_body.model)
    except ValueError as e:
        return _openai_error(
            message=str(e),
            error_type="invalid_request_error",
            code="model_not_found",
            status_code=404,
        )

    # --- Streaming response ---
    if request_body.stream:
        try:
            return StreamingResponse(
                _build_streaming_response(
                    provider=provider,
                    request_body=request_body,
                    completion_id=completion_id,
                    customer=customer,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        except Exception:
            # Try fallback provider for streaming
            fallback = get_fallback_provider(request_body.model)
            if fallback is None:
                return _openai_error(
                    message="Provider temporarily unavailable.",
                    error_type="server_error",
                    code="provider_error",
                    status_code=503,
                )
            return StreamingResponse(
                _build_streaming_response(
                    provider=fallback,
                    request_body=request_body,
                    completion_id=completion_id,
                    customer=customer,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

    # --- Non-streaming response ---
    try:
        result = await provider.chat_completion(
            model=request_body.model,
            messages=request_body.messages,
            temperature=request_body.temperature,
            max_tokens=request_body.max_tokens,
            top_p=request_body.top_p,
            frequency_penalty=request_body.frequency_penalty,
            presence_penalty=request_body.presence_penalty,
            stop=request_body.stop,
        )
    except Exception as primary_err:
        # Attempt fallback provider
        fallback = get_fallback_provider(request_body.model)
        if fallback is None:
            return _openai_error(
                message=f"Provider error: {str(primary_err)}",
                error_type="server_error",
                code="provider_error",
                status_code=503,
            )
        try:
            result = await fallback.chat_completion(
                model=request_body.model,
                messages=request_body.messages,
                temperature=request_body.temperature,
                max_tokens=request_body.max_tokens,
                top_p=request_body.top_p,
                frequency_penalty=request_body.frequency_penalty,
                presence_penalty=request_body.presence_penalty,
                stop=request_body.stop,
            )
        except Exception as fallback_err:
            return _openai_error(
                message=f"All providers failed: {str(fallback_err)}",
                error_type="server_error",
                code="provider_error",
                status_code=503,
            )

    # Extract response data from provider result
    content = result.get("content", "")
    prompt_tokens = result.get("prompt_tokens", 0)
    completion_tokens = result.get("completion_tokens", 0)
    total_tokens = prompt_tokens + completion_tokens
    finish_reason = result.get("finish_reason", "stop")
    model_used = result.get("model", request_body.model)

    # Build OpenAI-format response
    response = ChatCompletionResponse(
        id=completion_id,
        object="chat.completion",
        created=created,
        model=model_used,
        choices=[
            Choice(
                index=0,
                message=MessageContent(role="assistant", content=content),
                finish_reason=finish_reason,
            )
        ],
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        ),
    )

    # Log usage asynchronously - never block the response
    cost_usd, cost_inr = calculate_cost(
        request_body.model, prompt_tokens, completion_tokens
    )
    asyncio.create_task(
        log_usage(
            customer_id=customer.id,
            model=request_body.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            cost_inr=cost_inr,
            completion_id=completion_id,
        )
    )

    return response
