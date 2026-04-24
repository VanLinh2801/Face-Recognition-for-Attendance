"""Recognition event ORM model."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.shared.enums import EventDirection
from app.infrastructure.persistence.models.base import Base


class RecognitionEventModel(Base):
    __tablename__ = "recognition_events"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    person_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    face_registration_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("person_face_registrations.id"),
        nullable=False,
    )
    snapshot_media_asset_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    recognized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_direction: Mapped[EventDirection]
    match_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    spoof_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    event_source: Mapped[str] = mapped_column(String(100), nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB(astext_type=Text()), nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean(), nullable=False)
    invalid_reason: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
