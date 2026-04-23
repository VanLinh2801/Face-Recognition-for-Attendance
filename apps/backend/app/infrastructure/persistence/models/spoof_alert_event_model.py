"""Spoof alert event ORM model."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.shared.enums import SpoofReviewStatus, SpoofSeverity
from app.infrastructure.persistence.models.base import Base


class SpoofAlertEventModel(Base):
    __tablename__ = "spoof_alert_events"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    person_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="SET NULL"),
        nullable=True,
    )
    snapshot_media_asset_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    spoof_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    event_source: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB(astext_type=Text()), nullable=True)
    severity: Mapped[SpoofSeverity]
    review_status: Mapped[SpoofReviewStatus]
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
