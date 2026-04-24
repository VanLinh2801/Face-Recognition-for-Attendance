"""Unknown event domain entities."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.shared.enums import EventDirection, UnknownEventReviewStatus


@dataclass(slots=True, kw_only=True)
class UnknownEvent:
    id: UUID
    snapshot_media_asset_id: UUID | None
    detected_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    dedupe_key: str = ""
    raw_payload: dict[str, Any] | None
    review_status: UnknownEventReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
