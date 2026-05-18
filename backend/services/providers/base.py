"""Base provider class for LLM API integrations."""

import uuid
import time
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator

import httpx


def generate_id() -> str:
    """Generate a unique chat completion ID."""
    return f"chatcmpl-{uuid.uuid4().hex[:29]}"


def get_timestamp() -> int:
    """Get current Unix timestamp."""
    return int(time.time())


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    TIMEOUT = 30.0
    MODEL_MAP: dict[str, str] = {}

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(self.TIMEOUT))

    def resolve_model(self, model: str) -> str:
        """Resolve a friendly model name to the provider's actual model identifier."""
        return self.MODEL_MAP.get(model, model)

    @abstractmethod
    async def chat_completion(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> dict:
        """
        Perform a chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model name (friendly or provider-specific).
            **kwargs: Additional parameters (temperature, max_tokens, etc.)

        Returns:
            OpenAI-format response dict with id, object, model, choices, usage.
        """
        ...

    @abstractmethod
    async def chat_completion_stream(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """
        Perform a streaming chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model name (friendly or provider-specific).
            **kwargs: Additional parameters (temperature, max_tokens, etc.)

        Yields:
            SSE-formatted strings in OpenAI chunk format:
            data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"..."}}]}
        """
        ...
        # This yield is needed to make the type checker happy with the generator
        yield ""  # pragma: no cover

    async def close(self):
        """Close the underlying HTTP client."""
        await self.client.aclose()

    def _build_chunk_sse(
        self, chunk_id: str, model: str, content: str | None = None, finish_reason: str | None = None
    ) -> str:
        """Build an SSE-formatted chunk string in OpenAI format."""
        delta = {}
        if content is not None:
            delta["content"] = content

        chunk = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": get_timestamp(),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": delta,
                    "finish_reason": finish_reason,
                }
            ],
        }
        import json
        return f"data: {json.dumps(chunk)}\n\n"

    def _build_done_sse(self) -> str:
        """Build the final SSE done marker."""
        return "data: [DONE]\n\n"
