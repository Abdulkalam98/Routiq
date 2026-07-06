"""
Symmetric encryption for stored API keys using Fernet.
Keys are encrypted before database storage and decrypted at runtime.
Requires ENCRYPTION_KEY env var (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
"""

import logging
from cryptography.fernet import Fernet, InvalidToken

from config import get_settings

logger = logging.getLogger("routiq.encryption")

_fernet_instance = None


def _get_fernet() -> Fernet | None:
    """Get or create Fernet instance. Returns None if key not configured."""
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    settings = get_settings()
    if not settings.encryption_key:
        logger.warning("ENCRYPTION_KEY not set — BYOK keys cannot be encrypted")
        return None

    try:
        _fernet_instance = Fernet(settings.encryption_key.encode())
        return _fernet_instance
    except Exception as e:
        logger.error("Invalid ENCRYPTION_KEY: %s", e)
        return None


def encrypt_key(plaintext: str) -> str:
    """Encrypt an API key for database storage. Returns base64 ciphertext."""
    fernet = _get_fernet()
    if fernet is None:
        raise ValueError("Encryption not configured. Set ENCRYPTION_KEY env var.")
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext: str) -> str:
    """Decrypt a stored API key. Returns plaintext."""
    fernet = _get_fernet()
    if fernet is None:
        raise ValueError("Encryption not configured. Set ENCRYPTION_KEY env var.")
    try:
        return fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt key — ENCRYPTION_KEY may have changed")
