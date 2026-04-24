"""Recognition event domain entities."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.shared.enums import EventDirection


@dataclass(slots=True, kw_only=True)
class RecognitionEvent:
    id: UUID
    person_id: UUID
    face_registration_id: UUID
    snapshot_media_asset_id: UUID | None
    recognized_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    dedupe_key: str = ""
    raw_payload: dict[str, Any] | None
    is_valid: bool
    invalid_reason: str | None
    created_at: datetime
