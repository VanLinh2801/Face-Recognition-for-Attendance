"""Recognition event transport schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.shared.enums import EventDirection
from app.presentation.schemas.common import PaginatedResponse


class RecognitionEventItemResponse(BaseModel):
    id: UUID
    person_id: UUID
    face_registration_id: UUID
    snapshot_media_asset_id: UUID | None
    recognized_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    raw_payload: dict | None
    is_valid: bool
    invalid_reason: str | None
    created_at: datetime


class RecognitionEventListResponse(PaginatedResponse):
    items: list[RecognitionEventItemResponse]
