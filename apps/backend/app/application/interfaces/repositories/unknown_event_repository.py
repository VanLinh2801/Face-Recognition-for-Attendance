"""Unknown event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.shared.enums import UnknownEventReviewStatus
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
