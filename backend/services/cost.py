"""Cost calculation for LLM API usage."""

from config import get_settings


# Cost per 1K tokens in USD (before markup)
COST_TABLE: dict[str, dict[str, float]] = {
    "gpt-4o": {"input": 0.0025, "output": 0.010},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "claude-sonnet-4-6": {"input": 0.003, "output": 0.015},
    "claude-haiku": {"input": 0.00025, "output": 0.00125},
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
    "gemini-flash": {"input": 0.000075, "output": 0.0003},
    "mistral-large": {"input": 0.002, "output": 0.006},
    "mistral-small": {"input": 0.001, "output": 0.003},
}


def calculate_cost(
    model: str, prompt_tokens: int, completion_tokens: int
) -> tuple[float, float]:
    """
    Calculate the cost for an LLM API call.

    Args:
        model: The model name (friendly name, e.g., "gpt-4o", "claude-haiku").
        prompt_tokens: Number of input/prompt tokens used.
        completion_tokens: Number of output/completion tokens used.

    Returns:
        Tuple of (cost_usd, cost_inr) with Routiq markup applied.

    Raises:
        ValueError: If the model is not in the cost table.
    """
    settings = get_settings()

    if model not in COST_TABLE:
        raise ValueError(
            f"Unknown model '{model}' for cost calculation. "
            f"Available models: {', '.join(sorted(COST_TABLE.keys()))}"
        )

    costs = COST_TABLE[model]
    markup = settings.routiq_markup
    usd_to_inr = settings.usd_to_inr

    # Calculate cost: (tokens / 1000) * cost_per_1k * markup
    input_cost = (prompt_tokens / 1000.0) * costs["input"] * markup
    output_cost = (completion_tokens / 1000.0) * costs["output"] * markup

    total_usd = input_cost + output_cost
    total_inr = total_usd * usd_to_inr

    return total_usd, total_inr


def get_model_cost_per_1k(model: str) -> dict[str, float] | None:
    """
    Get the raw cost per 1K tokens for a model (before markup).

    Args:
        model: The model name.

    Returns:
        Dict with 'input' and 'output' costs, or None if model unknown.
    """
    return COST_TABLE.get(model)


def list_available_models() -> list[str]:
    """Return list of all models with known pricing."""
    return sorted(COST_TABLE.keys())
