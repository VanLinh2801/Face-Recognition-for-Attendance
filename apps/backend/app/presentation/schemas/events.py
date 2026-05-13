"""Unified event feed transport schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.presentation.schemas.common import PaginatedResponse


class EventFeedItemResponse(BaseModel):
    id: UUID
    type: str
    occurred_at: datetime
    person_id: UUID | None
    person_name: str | None
    direction: str | None
    score: float | None
    spoof_score: float | None
    source: str
    status: str
    severity: str | None
    review_status: str | None
    snapshot_media_asset_id: UUID | None
    raw_payload: dict[str, Any] | None
    metadata: dict[str, Any]


class EventFeedListResponse(PaginatedResponse):
    items: list[EventFeedItemResponse]
