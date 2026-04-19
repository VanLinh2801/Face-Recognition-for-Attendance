"""Spoof alert event domain entities."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.shared.enums import SpoofReviewStatus, SpoofSeverity


@dataclass(slots=True, kw_only=True)
class SpoofAlertEvent:
    id: UUID
    person_id: UUID | None
    snapshot_media_asset_id: UUID | None
    detected_at: datetime
    spoof_score: float
    event_source: str
    raw_payload: dict[str, Any] | None
    severity: SpoofSeverity
    review_status: SpoofReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
