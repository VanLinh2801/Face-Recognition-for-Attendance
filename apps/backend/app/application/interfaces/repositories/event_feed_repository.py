"""Unified event feed repository abstraction."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol
from uuid import UUID

from app.domain.shared.enums import EventDirection


class EventFeedType(StrEnum):
    ALL = "all"
    RECOGNITION = "recognition"
    UNKNOWN = "unknown"
    SPOOF = "spoof"


class ReviewStatusFilter(StrEnum):
    NEW = "new"
    REVIEWED = "reviewed"
    IGNORED = "ignored"


class SeverityFilter(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(slots=True, kw_only=True)
class EventFeedItem:
    id: UUID
    type: EventFeedType
    occurred_at: datetime
    person_id: UUID | None
    person_name: str | None
    direction: EventDirection | None
    score: float | None
    spoof_score: float | None
    source: str
    status: str
    severity: str | None
    review_status: str | None
    snapshot_media_asset_id: UUID | None
    raw_payload: dict[str, Any] | None
    metadata: dict[str, Any]


class EventFeedRepository(Protocol):
    def list_event_feed(
        self,
        *,
        page: int,
        page_size: int,
        event_type: EventFeedType = EventFeedType.ALL,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        query: str | None = None,
        review_status: ReviewStatusFilter | None = None,
        severity: SeverityFilter | None = None,
    ) -> tuple[list[EventFeedItem], int]: ...
