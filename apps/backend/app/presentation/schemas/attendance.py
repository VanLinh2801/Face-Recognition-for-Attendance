"""Attendance transport schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.domain.shared.enums import EventDirection
from app.presentation.schemas.common import PaginatedResponse


class AttendanceEventItemResponse(BaseModel):
    id: UUID
    person_id: UUID
    person_full_name: str
    recognized_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    is_valid: bool


class AttendanceEventListResponse(PaginatedResponse):
    items: list[AttendanceEventItemResponse]


class AttendanceDailySummaryResponse(BaseModel):
    work_date: date
    total_events: int
    unique_persons: int
    total_entries: int
    total_exits: int
