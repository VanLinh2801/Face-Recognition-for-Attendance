"""Unknown event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.shared.enums import EventDirection, UnknownEventReviewStatus
from app.domain.unknown_events.entities import UnknownEvent


class UnknownEventRepository(Protocol):
    """Read abstraction for unknown events."""

    def list_unknown_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: UnknownEventReviewStatus | None = None,
    ) -> tuple[list[UnknownEvent], int]: ...

    def list_unknown_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[UnknownEvent]: ...

    def get_by_dedupe_key(self, dedupe_key: str) -> UnknownEvent | None: ...

    def create_unknown_event(
        self,
        *,
        snapshot_media_asset_id: UUID | None,
        detected_at: datetime,
        event_direction: EventDirection,
        match_score: float | None,
        spoof_score: float | None,
        event_source: str,
        dedupe_key: str,
        review_status: UnknownEventReviewStatus,
        notes: str | None,
        raw_payload: dict | None,
    ) -> UnknownEvent: ...
