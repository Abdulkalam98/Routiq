"""Anthropic provider implementation with OpenAI format conversion."""

import json
from typing import Any, AsyncGenerator

import httpx

from .base import BaseLLMProvider, generate_id, get_timestamp


class AnthropicProvider(BaseLLMProvider):
    """Provider for Anthropic API (Claude models)."""

    API_BASE = "https://api.anthropic.com/v1/messages"
    API_VERSION = "2023-06-01"
    MODEL_MAP = {
        "claude-sonnet-4-6": "claude-sonnet-4-6-20250514",
        "claude-haiku": "claude-haiku-4-5-20241022",
    }

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.API_VERSION,
            "Content-Type": "application/json",
        }

    def _convert_messages_to_anthropic(
        self, messages: list[dict]
    ) -> tuple[str | None, list[dict]]:
        """
        Convert OpenAI-format messages to Anthropic format.
        Extracts system prompt and converts message roles.

        Returns:
            Tuple of (system_prompt, anthropic_messages)
        """
        system_prompt = None
        anthropic_messages = []

        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")

            if role == "system":
                # Anthropic uses a separate system parameter
                if system_prompt is None:
                    system_prompt = content
                else:
                    system_prompt += f"\n\n{content}"
            elif role == "assistant":
                anthropic_messages.append({"role": "assistant", "content": content})
            elif role == "user":
                anthropic_messages.append({"role": "user", "content": content})
            else:
                # Treat unknown roles as user messages
                anthropic_messages.append({"role": "user", "content": content})

        return system_prompt, anthropic_messages

    def _convert_response_to_openai(self, response_data: dict, model: str) -> dict:
        """Convert Anthropic response to OpenAI format."""
        # Extract text content from Anthropic response
        content = ""
        for block in response_data.get("content", []):
            if block.get("type") == "text":
                content += block.get("text", "")

        usage = response_data.get("usage", {})
        prompt_tokens = usage.get("input_tokens", 0)
        completion_tokens = usage.get("output_tokens", 0)

        # Map Anthropic stop reasons to OpenAI finish reasons
        stop_reason = response_data.get("stop_reason", "end_turn")
        finish_reason_map = {
            "end_turn": "stop",
            "max_tokens": "length",
            "stop_sequence": "stop",
        }
        finish_reason = finish_reason_map.get(stop_reason, "stop")

        return {
            "id": generate_id(),
            "object": "chat.completion",
            "created": get_timestamp(),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content,
                    },
                    "finish_reason": finish_reason,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    async def chat_completion(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> dict:
        """Call Anthropic messages API (non-streaming)."""
        resolved_model = self.resolve_model(model)
        system_prompt, anthropic_messages = self._convert_messages_to_anthropic(messages)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": anthropic_messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
        }

        if system_prompt:
            payload["system"] = system_prompt

        if "temperature" in kwargs and kwargs["temperature"] is not None:
            payload["temperature"] = kwargs["temperature"]
        if "top_p" in kwargs and kwargs["top_p"] is not None:
            payload["top_p"] = kwargs["top_p"]
        if "stop" in kwargs and kwargs["stop"] is not None:
            payload["stop_sequences"] = kwargs["stop"] if isinstance(kwargs["stop"], list) else [kwargs["stop"]]

        try:
            response = await self.client.post(
                self.API_BASE,
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            response_data = response.json()
            return self._convert_response_to_openai(response_data, model)
        except httpx.TimeoutException:
            raise TimeoutError(f"Anthropic API request timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Anthropic API error {e.response.status_code}: {e.response.text}"
            )

    async def chat_completion_stream(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Stream Anthropic messages API and convert to OpenAI SSE format."""
        resolved_model = self.resolve_model(model)
        system_prompt, anthropic_messages = self._convert_messages_to_anthropic(messages)

        payload: dict[str, Any] = {
            "model": resolved_model,
            "messages": anthropic_messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "stream": True,
        }

        if system_prompt:
            payload["system"] = system_prompt

        if "temperature" in kwargs and kwargs["temperature"] is not None:
            payload["temperature"] = kwargs["temperature"]
        if "top_p" in kwargs and kwargs["top_p"] is not None:
            payload["top_p"] = kwargs["top_p"]
        if "stop" in kwargs and kwargs["stop"] is not None:
            payload["stop_sequences"] = kwargs["stop"] if isinstance(kwargs["stop"], list) else [kwargs["stop"]]

        chunk_id = generate_id()

        try:
            async with self.client.stream(
                "POST",
                self.API_BASE,
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()

                # Send initial chunk with role
                yield self._build_chunk_sse(chunk_id, model, content=None, finish_reason=None)

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break

                    try:
                        event_data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    event_type = event_data.get("type", "")

                    if event_type == "content_block_delta":
                        delta = event_data.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield self._build_chunk_sse(chunk_id, model, content=text)

                    elif event_type == "message_delta":
                        # End of message - extract stop reason
                        stop_reason = event_data.get("delta", {}).get("stop_reason", "end_turn")
                        finish_reason_map = {
                            "end_turn": "stop",
                            "max_tokens": "length",
                            "stop_sequence": "stop",
                        }
                        finish_reason = finish_reason_map.get(stop_reason, "stop")
                        yield self._build_chunk_sse(chunk_id, model, finish_reason=finish_reason)

                yield self._build_done_sse()

        except httpx.TimeoutException:
            raise TimeoutError(f"Anthropic API stream timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Anthropic API error {e.response.status_code}: {e.response.text}"
            )
