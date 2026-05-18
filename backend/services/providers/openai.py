"""OpenAI provider implementation."""

import json
from typing import Any, AsyncGenerator

import httpx

from .base import BaseLLMProvider, generate_id, get_timestamp


class OpenAIProvider(BaseLLMProvider):
    """Provider for OpenAI API (GPT models)."""

    API_BASE = "https://api.openai.com/v1/chat/completions"
    MODEL_MAP = {
        "gpt-4o": "gpt-4o",
        "gpt-4o-mini": "gpt-4o-mini",
    }

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> dict:
        """Call OpenAI chat completions API (non-streaming)."""
        resolved_model = self.resolve_model(model)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "stream": False,
        }

        # Pass through supported parameters
        for param in ("temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty", "stop"):
            if param in kwargs and kwargs[param] is not None:
                payload[param] = kwargs[param]

        try:
            response = await self.client.post(
                self.API_BASE,
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise TimeoutError(f"OpenAI API request timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"OpenAI API error {e.response.status_code}: {e.response.text}"
            )

    async def chat_completion_stream(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Stream OpenAI chat completions via SSE."""
        resolved_model = self.resolve_model(model)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "stream": True,
        }

        for param in ("temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty", "stop"):
            if param in kwargs and kwargs[param] is not None:
                payload[param] = kwargs[param]

        try:
            async with self.client.stream(
                "POST",
                self.API_BASE,
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            yield self._build_done_sse()
                            return
                        # Pass through OpenAI's native SSE format
                        yield f"data: {data}\n\n"
                # If stream ends without [DONE]
                yield self._build_done_sse()
        except httpx.TimeoutException:
            raise TimeoutError(f"OpenAI API stream timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"OpenAI API error {e.response.status_code}: {e.response.text}"
            )
