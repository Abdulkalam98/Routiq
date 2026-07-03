"""
PII detection and redaction for chat messages.

Pure regex-based scanning — no external dependencies, no API calls.
Detects common PII patterns (email, phone, credit card, SSN, Aadhaar, IP)
and replaces them with safe placeholders before messages reach LLM providers.

Only scans user-role messages. System prompts are left intact.
Returns a report with redaction counts (never stores actual PII values).
"""

import re
from dataclasses import dataclass


@dataclass
class RedactionReport:
    """Summary of what was redacted. Never contains actual PII values."""

    email_count: int = 0
    phone_count: int = 0
    credit_card_count: int = 0
    ssn_aadhaar_count: int = 0
    ip_address_count: int = 0

    @property
    def total(self) -> int:
        return (
            self.email_count
            + self.phone_count
            + self.credit_card_count
            + self.ssn_aadhaar_count
            + self.ip_address_count
        )


# ---------------------------------------------------------------------------
# Compiled regex patterns (compiled once at module load for performance)
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[str, re.Pattern, str]] = [
    # Email addresses: user@domain.tld
    (
        "email",
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    # Credit card numbers: 13-19 digits (with optional spaces/dashes)
    # Intentionally broad — better to over-redact than leak card numbers
    (
        "credit_card",
        re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
        "[REDACTED_CARD]",
    ),
    # US SSN: XXX-XX-XXXX format
    (
        "ssn_aadhaar",
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "[REDACTED_SSN]",
    ),
    # Indian Aadhaar: XXXX XXXX XXXX or XXXX-XXXX-XXXX
    (
        "ssn_aadhaar",
        re.compile(r"\b\d{4}[- ]\d{4}[- ]\d{4}\b"),
        "[REDACTED_AADHAAR]",
    ),
    # Phone numbers: international + Indian formats
    # Matches: +1-234-567-8900, +91 98765 43210, (020) 7946-0958, etc.
    (
        "phone",
        re.compile(
            r"(?<!\d)(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)"
        ),
        "[REDACTED_PHONE]",
    ),
    # IPv4 addresses: valid octet ranges (0-255)
    (
        "ip_address",
        re.compile(
            r"\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\."
            r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\."
            r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\."
            r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
        ),
        "[REDACTED_IP]",
    ),
]

# Map pattern category → RedactionReport field name
_FIELD_MAP = {
    "email": "email_count",
    "phone": "phone_count",
    "credit_card": "credit_card_count",
    "ssn_aadhaar": "ssn_aadhaar_count",
    "ip_address": "ip_address_count",
}


def _redact_text(text: str, report: RedactionReport) -> str:
    """Apply all PII patterns to a single text string, updating the report."""
    for category, pattern, replacement in _PATTERNS:
        matches = pattern.findall(text)
        if matches:
            count = len(matches)
            field = _FIELD_MAP[category]
            setattr(report, field, getattr(report, field) + count)
            text = pattern.sub(replacement, text)
    return text


def redact_messages(
    messages: list[dict],
) -> tuple[list[dict], RedactionReport]:
    """
    Scan and redact PII from message content.

    Only processes 'user' role messages — system and assistant left intact.
    Returns a NEW list of messages (never mutates input) + a RedactionReport.
    """
    report = RedactionReport()
    result = []

    for msg in messages:
        if msg.get("role") == "user" and msg.get("content"):
            content = msg["content"]
            if isinstance(content, str):
                redacted = _redact_text(content, report)
                result.append({**msg, "content": redacted})
            else:
                # Multi-part content (list of content blocks) — skip
                result.append(msg)
        else:
            result.append(msg)

    return result, report
