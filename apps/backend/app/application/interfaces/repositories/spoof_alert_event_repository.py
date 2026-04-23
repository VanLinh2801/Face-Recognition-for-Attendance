"""Spoof alert event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.shared.enums import SpoofReviewStatus
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
