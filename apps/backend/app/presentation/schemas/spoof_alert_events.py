"""Spoof alert transport schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.shared.enums import SpoofReviewStatus, SpoofSeverity
from app.presentation.schemas.common import PaginatedResponse


class SpoofAlertEventItemResponse(BaseModel):
    id: UUID
    person_id: UUID | None
    snapshot_media_asset_id: UUID | None
    detected_at: datetime
    spoof_score: float
    event_source: str
    raw_payload: dict | None
    severity: SpoofSeverity
    review_status: SpoofReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


class SpoofAlertEventListResponse(PaginatedResponse):
    items: list[SpoofAlertEventItemResponse]
