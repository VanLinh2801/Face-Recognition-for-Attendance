"""Unknown event ORM model."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.shared.enums import EventDirection, UnknownEventReviewStatus
from app.infrastructure.persistence.models.base import Base


class UnknownEventModel(Base):
    __tablename__ = "unknown_events"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    snapshot_media_asset_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_direction: Mapped[EventDirection]
    match_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    spoof_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    event_source: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB(astext_type=Text()), nullable=True)
    review_status: Mapped[UnknownEventReviewStatus]
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
