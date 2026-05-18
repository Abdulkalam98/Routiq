"""Google Gemini provider - supports both AI Studio (free) and Vertex AI."""

import json
from typing import Any, AsyncGenerator

import httpx

from .base import BaseLLMProvider, generate_id, get_timestamp
from config import get_settings


class GoogleProvider(BaseLLMProvider):
    """Google Gemini provider - supports both AI Studio (free) and Vertex AI.

    Auto-detects which backend to use based on available config:
    - If GOOGLE_API_KEY is set -> use AI Studio (generativelanguage.googleapis.com)
      Free tier: 15 RPM, 1M tokens/day for Flash
    - If GOOGLE_CLOUD_PROJECT is set (and no API key) -> use Vertex AI
      (us-central1-aiplatform.googleapis.com) - $300 free credits for new GCP accounts
    """

    MODEL_MAP = {
        "gemini-1.5-pro": "gemini-1.5-pro-latest",
        "gemini-flash": "gemini-2.5-flash",
        "gemini-2.0-flash": "gemini-2.5-flash",
        "gemini-2.5-flash": "gemini-2.5-flash",
        "gemini-1.5-flash": "gemini-1.5-flash",
    }

    def __init__(self, api_key: str = ""):
        super().__init__(api_key=api_key)
        settings = get_settings()
        self.api_key = api_key or settings.google_api_key
        self.project_id = settings.google_cloud_project
        self.use_vertex = bool(self.project_id and not self.api_key)

        if self.use_vertex:
            # Vertex AI endpoint (free $300 credits for new GCP accounts)
            self.base_url = (
                f"https://us-central1-aiplatform.googleapis.com/v1/projects/"
                f"{self.project_id}/locations/us-central1/publishers/google/models"
            )
        else:
            # AI Studio endpoint (free tier: 15 RPM, 1M tokens/day for Flash)
            self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def _get_headers(self) -> dict[str, str]:
        """Get appropriate headers based on backend."""
        if self.use_vertex:
            # For Vertex AI, use application default credentials
            # In production, set GOOGLE_APPLICATION_CREDENTIALS env var
            # or use `gcloud auth application-default login` for local dev
            import subprocess

            try:
                token = subprocess.check_output(
                    ["gcloud", "auth", "print-access-token"],
                    stderr=subprocess.DEVNULL,
                ).decode().strip()
                return {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                }
            except (subprocess.CalledProcessError, FileNotFoundError):
                return {"Content-Type": "application/json"}
        else:
            return {"Content-Type": "application/json"}

    def _build_url(self, model: str, streaming: bool = False) -> str:
        """Build the API URL for the given model and backend."""
        resolved_model = self.resolve_model(model)
        action = "streamGenerateContent" if streaming else "generateContent"

        if self.use_vertex:
            url = f"{self.base_url}/{resolved_model}:{action}"
            if streaming:
                url += "?alt=sse"
            return url
        else:
            url = f"{self.base_url}/{resolved_model}:{action}?key={self.api_key}"
            if streaming:
                url += "&alt=sse"
            return url

    def _convert_messages(self, messages: list[dict], **kwargs: Any) -> dict:
        """Convert OpenAI messages format to Gemini format."""
        contents = []
        system_instruction = None

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                if system_instruction is None:
                    system_instruction = content
                else:
                    system_instruction += f"\n\n{content}"
                continue

            gemini_role = "model" if role == "assistant" else "user"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}],
            })

        body: dict[str, Any] = {"contents": contents}

        if system_instruction:
            body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        # Generation config
        generation_config: dict[str, Any] = {}
        if kwargs.get("temperature") is not None:
            generation_config["temperature"] = kwargs["temperature"]
        if kwargs.get("max_tokens") is not None:
            generation_config["maxOutputTokens"] = kwargs["max_tokens"]
        if kwargs.get("top_p") is not None:
            generation_config["topP"] = kwargs["top_p"]
        if kwargs.get("stop"):
            stop = kwargs["stop"]
            if isinstance(stop, str):
                stop = [stop]
            generation_config["stopSequences"] = stop

        if generation_config:
            body["generationConfig"] = generation_config

        return body

    def _parse_response(self, data: dict, model: str) -> dict:
        """Convert Gemini response to OpenAI format."""
        candidates = data.get("candidates", [{}])
        candidate = candidates[0] if candidates else {}
        content = candidate.get("content", {})
        parts = content.get("parts", [{}])
        text = parts[0].get("text", "") if parts else ""

        # Map finish reason
        finish_reason_map = {
            "STOP": "stop",
            "MAX_TOKENS": "length",
            "SAFETY": "content_filter",
            "RECITATION": "content_filter",
        }
        finish_reason = finish_reason_map.get(
            candidate.get("finishReason", "STOP"), "stop"
        )

        # Usage metadata
        usage_meta = data.get("usageMetadata", {})
        prompt_tokens = usage_meta.get("promptTokenCount", 0)
        completion_tokens = usage_meta.get("candidatesTokenCount", 0)

        return {
            "id": generate_id(),
            "object": "chat.completion",
            "created": get_timestamp(),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
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
        """Non-streaming chat completion."""
        url = self._build_url(model, streaming=False)
        body = self._convert_messages(messages, **kwargs)
        headers = self._get_headers()

        try:
            response = await self.client.post(url, json=body, headers=headers)
            response.raise_for_status()
            data = response.json()
            return self._parse_response(data, model)
        except httpx.TimeoutException:
            raise TimeoutError(f"Google API request timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Google API error {e.response.status_code}: {e.response.text}"
            )

    async def chat_completion_stream(
        self, messages: list[dict], model: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion."""
        url = self._build_url(model, streaming=True)
        body = self._convert_messages(messages, **kwargs)
        headers = self._get_headers()

        chunk_id = generate_id()

        try:
            async with self.client.stream(
                "POST", url, json=body, headers=headers
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    data_str = line[6:]  # Remove "data: " prefix
                    if data_str.strip() == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    candidates = data.get("candidates", [{}])
                    candidate = candidates[0] if candidates else {}
                    content = candidate.get("content", {})
                    parts = content.get("parts", [{}])
                    text = parts[0].get("text", "") if parts else ""

                    if text:
                        yield self._build_chunk_sse(chunk_id, model, content=text)

                    # Check for non-stop finish reason
                    gemini_finish = candidate.get("finishReason")
                    if gemini_finish and gemini_finish != "STOP":
                        finish_reason_map = {
                            "MAX_TOKENS": "length",
                            "SAFETY": "content_filter",
                            "RECITATION": "content_filter",
                        }
                        finish_reason = finish_reason_map.get(gemini_finish, "stop")
                        yield self._build_chunk_sse(
                            chunk_id, model, finish_reason=finish_reason
                        )

                # Send final stop chunk and done marker
                yield self._build_chunk_sse(chunk_id, model, finish_reason="stop")
                yield self._build_done_sse()

        except httpx.TimeoutException:
            raise TimeoutError(f"Google API stream timed out after {self.TIMEOUT}s")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Google API error {e.response.status_code}: {e.response.text}"
            )
