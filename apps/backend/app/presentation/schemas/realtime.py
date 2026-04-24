"""Realtime catch-up transport schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RealtimeCatchupItemResponse(BaseModel):
    event_type: str
    occurred_at: datetime
    correlation_id: str | None
    dedupe_key: str | None
    payload: dict[str, Any]
    metadata: dict[str, Any]


class RealtimeCatchupResponse(BaseModel):
    channel: str
    since_timestamp: datetime
    items: list[RealtimeCatchupItemResponse]


class RealtimeCatchupQueryParams(BaseModel):
    channel: str = Field(default="events.business")
    since_timestamp: datetime
    limit: int = Field(default=200, ge=1, le=1000)
