import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    api_key_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("api_keys.id", ondelete="SET NULL"),
        nullable=False,
        index=True,
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    cost_inr: Mapped[float] = mapped_column(Float, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Observability fields
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="success"
    )  # success, error, cached
    cache_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # exact, semantic, None
    completion_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # chatcmpl-xxx for request tracing
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # truncated error (first 200 chars)
    is_stream: Mapped[bool] = mapped_column(
        default=False, nullable=False
    )  # streaming vs non-streaming
    key_source: Mapped[str] = mapped_column(
        String(10), nullable=False, default="platform"
    )  # "platform" or "own" (BYOK)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="usage_logs")
    api_key: Mapped["ApiKey"] = relationship("ApiKey", back_populates="usage_logs")
