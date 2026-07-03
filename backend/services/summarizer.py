"""
Conversation summarization — compresses dropped messages into a brief summary.
Uses gemini-flash (cheapest model, already configured) to generate summaries.
Only triggered when dropped messages exceed 500 estimated tokens.
Fails open — if summarization fails, proceeds without summary.
"""

import httpx

from config import get_settings
from services.context_window import estimate_messages_tokens

MIN_TOKENS_TO_SUMMARIZE = 500  # Don't bother summarizing tiny drops

SUMMARY_PROMPT = """Summarize the following conversation turns into a brief context paragraph (max 100 words).
Focus on: key topics discussed, decisions made, and important facts mentioned.
Do NOT include greetings or filler. Be concise and factual.

Conversation:
{conversation}

Summary:"""


async def summarize_turns(messages: list[dict]) -> str | None:
    """
    Summarize dropped conversation turns using gemini-flash.

    Args:
        messages: The dropped messages to summarize

    Returns:
        A brief summary string, or None if summarization fails or isn't worth it.
    """
    if not messages:
        return None

    # Check if worth summarizing
    token_estimate = estimate_messages_tokens(messages)
    if token_estimate < MIN_TOKENS_TO_SUMMARIZE:
        return None

    settings = get_settings()
    if not settings.google_api_key:
        return None

    # Build conversation text from dropped messages
    conversation_text = "\n".join(
        f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
        for msg in messages
    )

    # Cap conversation text to avoid huge summarization calls
    if len(conversation_text) > 4000:
        conversation_text = conversation_text[:4000] + "\n[...truncated]"

    prompt = SUMMARY_PROMPT.format(conversation=conversation_text)

    # Call Gemini Flash for summarization
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={settings.google_api_key}"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": 150,
                        "temperature": 0.3,
                    },
                },
            )

            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        summary = parts[0].get("text", "").strip()
                        if summary:
                            return summary
    except Exception:
        pass  # Fail-open

    return None


def build_summary_message(summary: str) -> dict:
    """Build a system message containing the conversation summary."""
    return {
        "role": "system",
        "content": f"Previous conversation context: {summary}",
    }
