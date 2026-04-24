"""Attendance read repository abstraction."""

from __future__ import annotations

from datetime import date, datetime
from typing import Protocol
from uuid import UUID


class AttendanceEventView(Protocol):
    id: UUID
    person_id: UUID
    person_full_name: str
    recognized_at: datetime
    event_direction: str
    match_score: float | None
    spoof_score: float | None
    event_source: str
    is_valid: bool


class AttendanceSummaryView(Protocol):
    work_date: date
    total_events: int
    unique_persons: int
    total_entries: int
    total_exits: int


class AttendanceRepository(Protocol):
    def list_attendance_events(
        self,
        *,
        page: int,
        page_size: int,
        person_id: UUID | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
    ) -> tuple[list[AttendanceEventView], int]: ...

    def get_attendance_event(self, event_id: UUID) -> AttendanceEventView | None: ...

    def list_person_attendance_history(
        self,
        person_id: UUID,
        *,
        page: int,
        page_size: int,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
    ) -> tuple[list[AttendanceEventView], int]: ...

    def get_daily_summary(self, work_date: date) -> AttendanceSummaryView: ...
