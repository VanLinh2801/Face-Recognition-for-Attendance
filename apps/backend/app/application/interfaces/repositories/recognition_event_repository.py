"""Recognition event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.recognition_events.entities import RecognitionEvent
from app.domain.shared.enums import EventDirection


class RecognitionEventRepository(Protocol):
    """Read abstraction for recognition events."""

    def list_recognition_events(
        self,
        *,
        page: int,
        page_size: int,
        recognized_from: datetime | None = None,
        recognized_to: datetime | None = None,
    ) -> tuple[list[RecognitionEvent], int]: ...

    def list_recognition_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[RecognitionEvent]: ...

    def get_latest_recognition_time(self, *, person_id: UUID) -> datetime | None: ...

    def get_by_dedupe_key(self, dedupe_key: str) -> RecognitionEvent | None: ...

    def create_recognition_event(
        self,
        *,
        person_id: UUID,
        face_registration_id: UUID,
        snapshot_media_asset_id: UUID | None,
        recognized_at: datetime,
        event_direction: EventDirection,
        match_score: float | None,
        spoof_score: float | None,
        event_source: str,
        dedupe_key: str,
        raw_payload: dict | None,
    ) -> RecognitionEvent: ...
