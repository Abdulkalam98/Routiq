"""
Output guardrails — JSON mode enforcement.

Forces LLM responses to be valid JSON (with optional schema validation).
Auto-retries up to 3x with nudge prompts if response isn't valid JSON.
Fails open: if all retries fail, returns last response with X-Routiq-JSON-Valid: false.
"""

import json
import logging
from typing import Any

logger = logging.getLogger("routiq.json_guardrail")


def validate_json_response(content: str, response_format: dict) -> tuple[bool, str | None]:
    """
    Validate that content is valid JSON, and optionally matches a schema.

    Args:
        content: The LLM response text.
        response_format: Dict with "type" (json_object or json_schema) and optional "schema".

    Returns:
        (is_valid, error_message)
    """
    format_type = response_format.get("type")

    if format_type == "json_object":
        # Strip markdown code fences if present
        cleaned = _strip_code_fences(content)
        try:
            json.loads(cleaned)
            return True, None
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)[:100]}"

    elif format_type == "json_schema":
        schema = response_format.get("schema")
        cleaned = _strip_code_fences(content)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)[:100]}"

        if schema:
            try:
                import jsonschema
                jsonschema.validate(parsed, schema)
                return True, None
            except jsonschema.ValidationError as e:
                return False, f"Schema validation failed: {e.message[:100]}"
            except jsonschema.SchemaError as e:
                # Bad schema from user — treat as valid (don't penalize the model)
                logger.warning("Invalid JSON schema provided: %s", e.message[:100])
                return True, None

        return True, None

    # Unknown type — pass through
    return True, None


def build_json_system_prompt(response_format: dict) -> str:
    """Build a system prompt injection to guide the model toward JSON output."""
    format_type = response_format.get("type")

    if format_type == "json_object":
        return (
            "IMPORTANT: You must respond with valid JSON only. "
            "Do not include any text, explanation, or markdown before or after the JSON. "
            "Do not wrap the response in code fences. Output only the raw JSON object or array."
        )

    elif format_type == "json_schema":
        schema = response_format.get("schema", {})
        schema_str = json.dumps(schema, indent=2)
        return (
            f"IMPORTANT: You must respond with valid JSON that matches this exact schema:\n"
            f"{schema_str}\n\n"
            "Do not include any text, explanation, or markdown before or after the JSON. "
            "Do not wrap the response in code fences. Output only the raw JSON."
        )

    return ""


def build_retry_nudge(error_message: str) -> dict:
    """Build a user message nudging the model to fix its JSON output."""
    return {
        "role": "user",
        "content": (
            f"Your previous response was not valid JSON. Error: {error_message}. "
            "Please try again and respond ONLY with valid JSON — no other text, "
            "no code fences, no explanation. Just the raw JSON."
        ),
    }


def clean_json_response(content: str) -> str:
    """
    Attempt to extract valid JSON from a response that might have extra text.
    Returns cleaned content if successful, original content if not.
    """
    cleaned = _strip_code_fences(content)
    try:
        # Verify it's valid JSON
        json.loads(cleaned)
        return cleaned
    except json.JSONDecodeError:
        return content


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences (```json ... ``` or ``` ... ```) from text."""
    text = text.strip()
    # Handle ```json\n...\n```
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text
