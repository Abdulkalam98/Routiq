"""
Chat completions router - OpenAI-compatible POST /chat/completions
"""

import asyncio
import logging
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from middleware.auth import get_current_customer
from middleware.ratelimit import check_rate_limit
from middleware.token_budget import check_token_budget, increment_token_budget
from middleware.prompt_guard import check_prompt_injection, format_block_response
from services.pii_redactor import redact_messages
from services.router import get_provider, get_provider_smart, get_fallback_provider
from services.byok import get_provider_for_customer
from services.cost import calculate_cost
from services.usage import log_usage
from services.cache import get_cached_response, set_cached_response
from services.semantic_cache import find_similar_cached, store_semantic_cache
from services.context_window import trim_messages, get_tokens_saved
from services.summarizer import summarize_turns, build_summary_message
from services.json_guardrail import (
    validate_json_response,
    build_json_system_prompt,
    build_retry_nudge,
    clean_json_response,
)

logger = logging.getLogger("routiq.chat")

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
    response_format: dict | None = None  # {"type": "json_object"} or {"type": "json_schema", "schema": {...}}


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
    resolved_model: str,
    request_body: ChatCompletionRequest,
    completion_id: str,
    customer,
    api_key_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Yield SSE-formatted chunks from the provider's streaming response.
    The provider already yields properly formatted SSE strings.
    After the stream ends, log usage asynchronously.
    """
    prompt_tokens = 0
    completion_tokens = 0

    try:
        async for sse_chunk in provider.chat_completion_stream(
            model=resolved_model,
            messages=request_body.messages,
            temperature=request_body.temperature,
            max_tokens=request_body.max_tokens,
            top_p=request_body.top_p,
            frequency_penalty=request_body.frequency_penalty,
            presence_penalty=request_body.presence_penalty,
            stop=request_body.stop,
        ):
            yield sse_chunk

            # Rough token estimate from streamed content length
            completion_tokens += 1

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
        # Increment token budget for streaming responses
        if api_key_id:
            asyncio.create_task(
                increment_token_budget(api_key_id, prompt_tokens + completion_tokens)
            )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/chat/completions")
async def chat_completions(
    request: Request,
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

    # --- Security checks (order: budget → injection → PII) ---

    # 1. Token budget check (raises 429 if exceeded)
    await check_token_budget(request, customer)

    # 2. Prompt injection detection (runs on raw messages)
    injection_result = check_prompt_injection(request_body.messages)
    if injection_result.action == "block":
        logger.warning(
            "Prompt injection blocked | score=%d patterns=%s",
            injection_result.score,
            injection_result.matched_patterns,
        )
        return JSONResponse(
            status_code=400,
            content=format_block_response(injection_result),
        )

    # 3. PII redaction (clean messages before any caching or provider call)
    redacted_messages, pii_report = redact_messages(request_body.messages)
    if pii_report.total > 0:
        request_body.messages = redacted_messages

    # --- End security checks ---

    # Resolve provider for requested model (BYOK: check user's own keys first)
    try:
        provider, resolved_model, key_source = await get_provider_for_customer(
            customer_id=customer.id,
            model_name=request_body.model,
            messages=request_body.messages,
        )
        actual_model = request_body.model if request_body.model != "auto" else resolved_model
    except ValueError as e:
        return _openai_error(
            message=str(e),
            error_type="invalid_request_error",
            code="model_not_found",
            status_code=404,
        )

    # --- Streaming response ---
    if request_body.stream:
        # JSON mode is incompatible with streaming
        if request_body.response_format:
            return _openai_error(
                message="response_format is not supported with streaming. Set stream=false.",
                error_type="invalid_request_error",
                code="unsupported_parameter",
                status_code=400,
            )
        stream_api_key_id = getattr(request.state, "api_key_id", None)
        try:
            return StreamingResponse(
                _build_streaming_response(
                    provider=provider,
                    resolved_model=resolved_model,
                    request_body=request_body,
                    completion_id=completion_id,
                    customer=customer,
                    api_key_id=stream_api_key_id,
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
            fallback_result = get_fallback_provider(request_body.model)
            if fallback_result is None:
                return _openai_error(
                    message="Provider temporarily unavailable.",
                    error_type="server_error",
                    code="provider_error",
                    status_code=503,
                )
            fallback_provider, fallback_model = fallback_result
            return StreamingResponse(
                _build_streaming_response(
                    provider=fallback_provider,
                    resolved_model=fallback_model,
                    request_body=request_body,
                    completion_id=completion_id,
                    customer=customer,
                    api_key_id=stream_api_key_id,
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

    # --- Non-streaming response ---

    # Check cache first (only for non-streaming)
    api_key_id = getattr(request.state, "api_key_id", None)
    cached = await get_cached_response(actual_model, request_body.messages)
    if cached:
        # Log cache hit
        asyncio.create_task(
            log_usage(
                customer_id=customer.id,
                model=actual_model,
                prompt_tokens=0,
                completion_tokens=0,
                cost_usd=0.0,
                cost_inr=0.0,
                completion_id=completion_id,
                api_key_id=api_key_id,
                status="cached",
                cache_type="exact",
            )
        )
        return JSONResponse(
            content={
                "id": completion_id,
                "object": "chat.completion",
                "created": created,
                "model": cached.get("model", actual_model),
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": cached["content"]},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            },
            headers={"X-Routiq-Cached": "true"},
        )

    # Semantic cache check (if exact match missed)
    semantic_hit = await find_similar_cached(request_body.messages, actual_model)
    if semantic_hit:
        # Log semantic cache hit
        asyncio.create_task(
            log_usage(
                customer_id=customer.id,
                model=actual_model,
                prompt_tokens=0,
                completion_tokens=0,
                cost_usd=0.0,
                cost_inr=0.0,
                completion_id=completion_id,
                api_key_id=api_key_id,
                status="cached",
                cache_type="semantic",
            )
        )
        return JSONResponse(
            content={
                "id": completion_id,
                "object": "chat.completion",
                "created": created,
                "model": semantic_hit.get("model", actual_model),
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": semantic_hit["content"]},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            },
            headers={
                "X-Routiq-Cached": "true",
                "X-Routiq-Cache-Type": "semantic",
            },
        )

    # Context window trimming + summarization
    messages_to_send = request_body.messages
    tokens_saved = 0
    trimmed_messages, was_trimmed, dropped = trim_messages(request_body.messages)
    if was_trimmed:
        tokens_saved = get_tokens_saved(request_body.messages, trimmed_messages)
        # Summarize dropped messages (async but we need the result)
        summary = await summarize_turns(dropped)
        if summary:
            summary_msg = build_summary_message(summary)
            # Insert summary after system message (or at start)
            if trimmed_messages and trimmed_messages[0].get("role") == "system":
                messages_to_send = [trimmed_messages[0], summary_msg] + trimmed_messages[1:]
            else:
                messages_to_send = [summary_msg] + trimmed_messages
        else:
            messages_to_send = trimmed_messages

    # --- JSON mode: inject system prompt ---
    json_valid = True
    if request_body.response_format:
        json_system_prompt = build_json_system_prompt(request_body.response_format)
        if json_system_prompt:
            if messages_to_send and messages_to_send[0].get("role") == "system":
                messages_to_send = [
                    {**messages_to_send[0], "content": messages_to_send[0]["content"] + "\n\n" + json_system_prompt}
                ] + messages_to_send[1:]
            else:
                messages_to_send = [{"role": "system", "content": json_system_prompt}] + messages_to_send

    # --- Provider call (with JSON retry loop) ---
    max_retries = 3 if request_body.response_format else 0
    retry_messages = messages_to_send

    for attempt in range(max_retries + 1):
        try:
            result = await provider.chat_completion(
                model=resolved_model,
                messages=retry_messages,
                temperature=request_body.temperature,
                max_tokens=request_body.max_tokens,
                top_p=request_body.top_p,
                frequency_penalty=request_body.frequency_penalty,
                presence_penalty=request_body.presence_penalty,
                stop=request_body.stop,
            )
        except Exception as primary_err:
            # No fallback when using BYOK (user's key, user's risk)
            if key_source == "own":
                return _openai_error(
                    message=f"Provider error with your API key: {str(primary_err)}",
                    error_type="server_error",
                    code="provider_error",
                    status_code=503,
                )
            # Attempt fallback provider (platform keys only)
            fallback_result = get_fallback_provider(request_body.model)
            if fallback_result is None:
                return _openai_error(
                    message=f"Provider error: {str(primary_err)}",
                    error_type="server_error",
                    code="provider_error",
                    status_code=503,
                )
            fallback_provider, fallback_model = fallback_result
            try:
                result = await fallback_provider.chat_completion(
                    model=fallback_model,
                    messages=retry_messages,
                    temperature=request_body.temperature,
                    max_tokens=request_body.max_tokens,
                    top_p=request_body.top_p,
                    frequency_penalty=request_body.frequency_penalty,
                    presence_penalty=request_body.presence_penalty,
                    stop=request_body.stop,
                )
            except Exception as fallback_err:
                return _openai_error(
                    message=f"All providers failed. Primary: {str(primary_err)}. Fallback: {str(fallback_err)}",
                    error_type="server_error",
                    code="provider_error",
                    status_code=503,
                )

        # Extract content for JSON validation
        resp_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not request_body.response_format:
            break  # No validation needed

        is_valid, error_msg = validate_json_response(resp_content, request_body.response_format)
        if is_valid:
            # Clean code fences if present
            cleaned = clean_json_response(resp_content)
            if cleaned != resp_content:
                result["choices"][0]["message"]["content"] = cleaned
            json_valid = True
            break

        json_valid = False
        if attempt < max_retries:
            # Append failed response + retry nudge for next attempt
            retry_messages = retry_messages + [
                {"role": "assistant", "content": resp_content},
                build_retry_nudge(error_msg or "Invalid JSON"),
            ]
            logger.info("JSON guardrail retry %d/%d: %s", attempt + 1, max_retries, error_msg)

    # Extract response data from provider result (OpenAI nested format)
    choices = result.get("choices", [])
    choice = choices[0] if choices else {}
    content = choice.get("message", {}).get("content", "")
    finish_reason = choice.get("finish_reason", "stop")
    usage_data = result.get("usage", {})
    prompt_tokens = usage_data.get("prompt_tokens", 0)
    completion_tokens = usage_data.get("completion_tokens", 0)
    total_tokens = usage_data.get("total_tokens", prompt_tokens + completion_tokens)
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
        actual_model, prompt_tokens, completion_tokens
    )
    api_key_id = getattr(request.state, "api_key_id", None)
    asyncio.create_task(
        log_usage(
            customer_id=customer.id,
            model=actual_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost_usd,
            cost_inr=cost_inr,
            completion_id=completion_id,
            api_key_id=api_key_id,
            latency_ms=int((time.time() - created) * 1000),
            status="success",
            is_stream=False,
            key_source=key_source,
        )
    )

    # Cache the response for future identical requests
    asyncio.create_task(
        set_cached_response(actual_model, request_body.messages, {
            "content": content,
            "model": model_used,
        })
    )

    # Store in semantic cache for future similar requests
    asyncio.create_task(
        store_semantic_cache(request_body.messages, actual_model, content)
    )

    # Increment token budget counter (async, fire-and-forget)
    if api_key_id:
        asyncio.create_task(increment_token_budget(api_key_id, total_tokens))

    # Build response headers (tokens saved + security headers + guardrails)
    headers = {}
    if tokens_saved > 0:
        headers["X-Routiq-Tokens-Saved"] = str(tokens_saved)
    if pii_report.total > 0:
        headers["X-Routiq-PII-Redacted"] = str(pii_report.total)
    if injection_result.action == "warn":
        headers["X-Routiq-Injection-Risk"] = "medium"
    if request_body.response_format:
        headers["X-Routiq-JSON-Valid"] = "true" if json_valid else "false"
    if key_source == "own":
        headers["X-Routiq-Key-Source"] = "own"

    return JSONResponse(content=response.model_dump(), headers=headers) if headers else response
