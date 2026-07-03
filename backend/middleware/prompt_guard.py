"""
Prompt injection and jailbreak detection.

Score-based system using weighted pattern matching:
- Score >= 3: BLOCK (return 400, request never reaches provider)
- Score 1-2: WARN (allow, log, add X-Routiq-Injection-Risk header)
- Score 0: PASS (clean request)

Pure regex — zero external API calls, zero cost, runs in <1ms.
Only scans user-role messages. Never logs actual prompt content.
"""

import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("routiq.prompt_guard")


@dataclass
class InjectionResult:
    """Result of prompt injection analysis."""

    action: str  # "pass", "warn", "block"
    score: int
    matched_patterns: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# HIGH-WEIGHT PATTERNS (score +2 each) — strong injection indicators
# ---------------------------------------------------------------------------

_HIGH_PATTERNS: list[tuple[str, re.Pattern]] = [
    (
        "ignore_previous",
        re.compile(
            r"ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+"
            r"(?:instructions|prompts|rules|guidelines|context)",
            re.IGNORECASE,
        ),
    ),
    (
        "you_are_now",
        re.compile(
            r"you\s+are\s+now\s+(?!going|about|ready|able|welcome)",
            re.IGNORECASE,
        ),
    ),
    (
        "dan_mode",
        re.compile(
            r"\b(?:DAN|D\.A\.N)\b.*(?:mode|enabled|activated|prompt)",
            re.IGNORECASE,
        ),
    ),
    (
        "jailbreak_keyword",
        re.compile(
            r"\b(?:jailbreak|jail[\s-]?break|jail[\s-]?broken)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "system_prompt_extract",
        re.compile(
            r"(?:repeat|show|display|print|output|reveal|tell\s+me|give\s+me)\s+"
            r"(?:your|the)\s+(?:system\s+)?(?:prompt|instructions|rules|guidelines|directives)",
            re.IGNORECASE,
        ),
    ),
    (
        "override_instructions",
        re.compile(
            r"(?:override|disregard|forget|bypass|circumvent)\s+"
            r"(?:your|all|any|the)?\s*"
            r"(?:previous|prior|original|current|safety)?\s*"
            r"(?:instructions|rules|programming|guidelines|restrictions|filters)",
            re.IGNORECASE,
        ),
    ),
]

# ---------------------------------------------------------------------------
# MEDIUM-WEIGHT PATTERNS (score +1 each) — weaker signals, need combination
# ---------------------------------------------------------------------------

_MEDIUM_PATTERNS: list[tuple[str, re.Pattern]] = [
    (
        "pretend_you_are",
        re.compile(
            r"(?:pretend|act|behave|imagine)\s+(?:you\s+are|to\s+be|as\s+if\s+you)",
            re.IGNORECASE,
        ),
    ),
    (
        "without_restrictions",
        re.compile(
            r"(?:without|no|free\s+from|remove(?:d)?)\s+(?:any\s+)?"
            r"(?:restrictions|limitations|filters|safeguards|guardrails|constraints|censorship)",
            re.IGNORECASE,
        ),
    ),
    (
        "ignore_programming",
        re.compile(
            r"ignore\s+(?:your)?\s*(?:programming|training|alignment|safety|ethics)",
            re.IGNORECASE,
        ),
    ),
    (
        "roleplay_unrestricted",
        re.compile(
            r"(?:roleplay|role[\s-]?play)\s+as\s+(?:an?\s+)?"
            r"(?:unrestricted|uncensored|unfiltered|evil|malicious)",
            re.IGNORECASE,
        ),
    ),
    (
        "what_are_instructions",
        re.compile(
            r"what\s+(?:are|were)\s+(?:your|the)\s+"
            r"(?:original\s+)?(?:instructions|system\s+prompt|rules|directives)",
            re.IGNORECASE,
        ),
    ),
    (
        "developer_mode",
        re.compile(
            r"\b(?:developer|dev|admin|sudo|root|god)\s*mode\b",
            re.IGNORECASE,
        ),
    ),
    (
        "do_anything",
        re.compile(
            r"(?:do\s+anything\s+now|no\s+ethical\s+guidelines|unlimited\s+mode|unhinged\s+mode)",
            re.IGNORECASE,
        ),
    ),
]

# Thresholds
BLOCK_THRESHOLD = 3
WARN_THRESHOLD = 1


def check_prompt_injection(messages: list[dict]) -> InjectionResult:
    """
    Scan messages for prompt injection / jailbreak patterns.

    Only analyzes user-role messages. Returns action + score + matched names.
    Designed to run before any caching or provider calls.
    """
    # Extract all user message text
    user_texts = []
    for msg in messages:
        if msg.get("role") == "user" and msg.get("content"):
            content = msg["content"]
            if isinstance(content, str):
                user_texts.append(content)

    if not user_texts:
        return InjectionResult(action="pass", score=0)

    combined_text = "\n".join(user_texts)
    score = 0
    matched = []

    # Check high-weight patterns (score +2 each)
    for name, pattern in _HIGH_PATTERNS:
        if pattern.search(combined_text):
            score += 2
            matched.append(name)

    # Check medium-weight patterns (score +1 each)
    for name, pattern in _MEDIUM_PATTERNS:
        if pattern.search(combined_text):
            score += 1
            matched.append(name)

    # Determine action based on threshold
    if score >= BLOCK_THRESHOLD:
        action = "block"
    elif score >= WARN_THRESHOLD:
        action = "warn"
    else:
        action = "pass"

    return InjectionResult(action=action, score=score, matched_patterns=matched)


def format_block_response(result: InjectionResult) -> dict:
    """Format an OpenAI-compatible error response for blocked requests."""
    return {
        "error": {
            "message": "Request blocked: potential prompt injection detected.",
            "type": "content_policy_error",
            "code": "prompt_injection_detected",
        }
    }
