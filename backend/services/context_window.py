"""
Context window management — trims conversations to fit token limits.
Keeps system prompt + most recent messages. Returns flag if trimming occurred.
Uses simple heuristic: 4 chars ≈ 1 token (no tiktoken dependency).
"""


DEFAULT_MAX_TOKENS = 6000  # Leave room for response tokens
KEEP_RECENT_TURNS = 4  # Always keep last N user+assistant pairs (8 messages)


def estimate_tokens(text: str) -> int:
    """Estimate token count using 4 chars ≈ 1 token heuristic."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """Estimate total tokens across all messages."""
    total = 0
    for msg in messages:
        # ~4 tokens overhead per message (role, formatting)
        total += 4
        total += estimate_tokens(msg.get("content", ""))
    return total


def trim_messages(
    messages: list[dict], max_tokens: int = DEFAULT_MAX_TOKENS
) -> tuple[list[dict], bool, list[dict]]:
    """
    Trim messages to fit within max_tokens.

    Strategy:
    1. Always keep the first system message (if any)
    2. Always keep the last KEEP_RECENT_TURNS pairs
    3. Drop middle messages oldest-first

    Returns:
        tuple of (trimmed_messages, was_trimmed, dropped_messages)
        - trimmed_messages: messages that fit within the token budget
        - was_trimmed: True if any messages were dropped
        - dropped_messages: messages that were removed (for summarization)
    """
    total_tokens = estimate_messages_tokens(messages)

    # If already within budget, return as-is
    if total_tokens <= max_tokens:
        return messages, False, []

    # Separate system message (if first message is system)
    system_msg = None
    conversation = messages
    if messages and messages[0].get("role") == "system":
        system_msg = messages[0]
        conversation = messages[1:]

    # Keep last N turns (KEEP_RECENT_TURNS * 2 messages for user+assistant pairs)
    keep_count = min(len(conversation), KEEP_RECENT_TURNS * 2)
    recent = conversation[-keep_count:]
    middle = conversation[:-keep_count] if keep_count < len(conversation) else []

    # Build result: system + recent
    result = []
    if system_msg:
        result.append(system_msg)
    result.extend(recent)

    # Check if we're still over budget — if so, trim recent too
    while estimate_messages_tokens(result) > max_tokens and len(result) > 2:
        # Remove oldest non-system message
        if result[0].get("role") == "system":
            if len(result) > 2:
                middle.append(result[1])
                result.pop(1)
            else:
                break
        else:
            middle.insert(0, result[0])
            result.pop(0)

    was_trimmed = len(middle) > 0
    return result, was_trimmed, middle


def get_tokens_saved(original: list[dict], trimmed: list[dict]) -> int:
    """Calculate how many tokens were saved by trimming."""
    original_tokens = estimate_messages_tokens(original)
    trimmed_tokens = estimate_messages_tokens(trimmed)
    return max(0, original_tokens - trimmed_tokens)
