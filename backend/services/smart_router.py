"""Smart auto-routing: analyzes prompt complexity to pick the cheapest adequate model."""

import re


# Complexity signals (keywords/patterns that suggest complex reasoning)
COMPLEXITY_SIGNALS = [
    "explain",
    "analyze",
    "compare",
    "contrast",
    "debug",
    "refactor",
    "architect",
    "design",
    "optimize",
    "trade-off",
    "pros and cons",
    "step by step",
    "in detail",
    "comprehensive",
    "thorough",
    "why does",
    "how does",
    "what causes",
    "implement",
    "algorithm",
]

CODE_PATTERN = re.compile(r"```|def |class |function |import |const |let |var |async |await ")

# Simplicity signals
SIMPLICITY_SIGNALS = [
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "yes",
    "no",
    "ok",
    "translate",
    "fix grammar",
    "summarize this",
    "what is",
    "who is",
    "when was",
]


def classify_prompt(messages: list[dict]) -> str:
    """
    Classify the last user message into a complexity tier.
    Returns: 'simple', 'medium', or 'complex'
    """
    # Get the last user message
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break

    if not last_user_msg:
        return "simple"

    text = last_user_msg.lower().strip()
    word_count = len(text.split())

    # Check for simplicity first
    if word_count <= 8:
        for signal in SIMPLICITY_SIGNALS:
            if signal in text:
                return "simple"

    # Check for code blocks
    has_code = bool(CODE_PATTERN.search(last_user_msg))

    # Count complexity signals
    complexity_score = 0
    for signal in COMPLEXITY_SIGNALS:
        if signal in text:
            complexity_score += 1

    # Multiple questions (question marks)
    question_count = text.count("?")
    if question_count >= 2:
        complexity_score += 1

    # Classification rules
    if word_count <= 15 and complexity_score == 0 and not has_code:
        return "simple"
    elif complexity_score >= 2 or (has_code and word_count > 100) or word_count > 200:
        return "complex"
    else:
        return "medium"


def smart_route(messages: list[dict]) -> str:
    """
    Pick the cheapest adequate model based on prompt analysis.
    Returns: model name string (friendly name used by COST_TABLE)
    """
    tier = classify_prompt(messages)

    if tier == "simple":
        return "gemini-flash"  # cheapest: ₹0.000075/1K input
    elif tier == "medium":
        return "gpt-4o-mini"  # mid: ₹0.00015/1K input
    else:
        return "gpt-4o"  # complex: ₹0.0025/1K input
