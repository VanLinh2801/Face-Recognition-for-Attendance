"""Spoof alert event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.shared.enums import SpoofReviewStatus, SpoofSeverity
from app.domain.spoof_alert_events.entities import SpoofAlertEvent


class SpoofAlertEventRepository(Protocol):
    """Read abstraction for spoof alert events."""

    def list_spoof_alert_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: SpoofReviewStatus | None = None,
    ) -> tuple[list[SpoofAlertEvent], int]: ...

    def list_spoof_alert_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[SpoofAlertEvent]: ...

    def get_latest_spoof_time(self, *, person_id: UUID) -> datetime | None: ...

    def get_by_dedupe_key(self, dedupe_key: str) -> SpoofAlertEvent | None: ...

    def create_spoof_alert_event(
        self,
        *,
        person_id: UUID | None,
        snapshot_media_asset_id: UUID | None,
        detected_at: datetime,
        spoof_score: float,
        event_source: str,
        dedupe_key: str,
        severity: SpoofSeverity,
        review_status: SpoofReviewStatus,
        notes: str | None,
        raw_payload: dict | None,
    ) -> SpoofAlertEvent: ...
