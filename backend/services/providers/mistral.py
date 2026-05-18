"""Mistral provider implementation."""

import json
from typing import Any, AsyncGenerator

import httpx

from .base import BaseLLMProvider, generate_id, get_timestamp


class MistralProvider(BaseLLMProvider):
    """Provider for Mistral AI API."""

    API_BASE = "https://api.mistral.ai/v1/chat/completions"
    MODEL_MAP = {
        "mistral-large": "mistral-large-latest",
        "mistral-small": "mistral-small-latest",
    }

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> dict:
        """Call Mistral chat completions API (non-streaming)."""
        resolved_model = self.resolve_model(model)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "stream": False,
        }

        # Pass through supported parameters
        for param in ("temperature", "max_tokens", "top_p", "stop"):
            if param in kwargs and kwargs[param] is not None:
                payload[param] = kwargs[param]

        try:
            response = await self.client.post(
                self.API_BASE,
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            # Mistral returns nearly OpenAI-compatible format,
            # ensure it has the expected fields
            usage = data.get("usage", {})
            if "total_tokens" not in usage:
                usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)
                data["usage"] = usage

            # Ensure ID has our prefix if missing
            if not data.get("id", "").startswith("chatcmpl-"):
                data["id"] = generate_id()

            return data
        except httpx.TimeoutException:
            raise TimeoutError(f"Mistral API request timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Mistral API error {e.response.status_code}: {e.response.text}"
            )

    async def chat_completion_stream(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Stream Mistral chat completions via SSE."""
        resolved_model = self.resolve_model(model)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "stream": True,
        }

        for param in ("temperature", "max_tokens", "top_p", "stop"):
            if param in kwargs and kwargs[param] is not None:
                payload[param] = kwargs[param]

        chunk_id = generate_id()

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
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        yield self._build_done_sse()
                        return

                    try:
                        event_data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    # Mistral stream format is very similar to OpenAI
                    choices = event_data.get("choices", [])
                    if choices:
                        choice = choices[0]
                        delta = choice.get("delta", {})
                        content = delta.get("content")
                        finish_reason = choice.get("finish_reason")

                        if content:
                            yield self._build_chunk_sse(chunk_id, model, content=content)
                        elif finish_reason:
                            yield self._build_chunk_sse(chunk_id, model, finish_reason=finish_reason)

                # If stream ends without [DONE]
                yield self._build_done_sse()

        except httpx.TimeoutException:
            raise TimeoutError(f"Mistral API stream timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Mistral API error {e.response.status_code}: {e.response.text}"
            )
