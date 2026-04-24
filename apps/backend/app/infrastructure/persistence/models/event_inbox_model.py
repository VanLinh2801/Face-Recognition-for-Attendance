"""Event inbox ORM model for idempotency."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class EventInboxModel(Base):
    __tablename__ = "event_inbox"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    message_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, unique=True)
    event_name: Mapped[str] = mapped_column(String(255), nullable=False)
    producer: Mapped[str] = mapped_column(String(50), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB(astext_type=Text()), nullable=True)
