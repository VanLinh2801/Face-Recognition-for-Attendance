"""Unknown event transport schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.shared.enums import EventDirection, UnknownEventReviewStatus
from app.presentation.schemas.common import PaginatedResponse


class UnknownEventItemResponse(BaseModel):
    id: UUID
    snapshot_media_asset_id: UUID | None
    detected_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    raw_payload: dict | None
    review_status: UnknownEventReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


class UnknownEventListResponse(PaginatedResponse):
    items: list[UnknownEventItemResponse]
