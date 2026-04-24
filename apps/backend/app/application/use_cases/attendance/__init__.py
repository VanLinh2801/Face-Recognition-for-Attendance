"""Attendance read use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.attendance_repository import AttendanceRepository
from app.core.exceptions import NotFoundError


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


class AttendanceDailySummaryView(Protocol):
    work_date: date
    total_events: int
    unique_persons: int
    total_entries: int
    total_exits: int


@dataclass(slots=True, kw_only=True)
class ListAttendanceEventsQuery:
    page: int = 1
    page_size: int = 20
    person_id: UUID | None = None
    from_at: datetime | None = None
    to_at: datetime | None = None


@dataclass(slots=True, kw_only=True)
class ListPersonAttendanceHistoryQuery:
    person_id: UUID
    page: int = 1
    page_size: int = 20
    from_at: datetime | None = None
    to_at: datetime | None = None


class ListAttendanceEventsUseCase:
    def __init__(self, repository: AttendanceRepository) -> None:
        self._repository = repository

    def execute(self, query: ListAttendanceEventsQuery) -> PageResult[AttendanceEventView]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_attendance_events(
            page=page_query.page,
            page_size=page_query.page_size,
            person_id=query.person_id,
            from_at=query.from_at,
            to_at=query.to_at,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class GetAttendanceEventUseCase:
    def __init__(self, repository: AttendanceRepository) -> None:
        self._repository = repository

    def execute(self, event_id: UUID) -> AttendanceEventView:
        event = self._repository.get_attendance_event(event_id)
        if event is None:
            raise NotFoundError("Attendance event not found")
        return event


class ListPersonAttendanceHistoryUseCase:
    def __init__(self, repository: AttendanceRepository) -> None:
        self._repository = repository

    def execute(self, query: ListPersonAttendanceHistoryQuery) -> PageResult[AttendanceEventView]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_person_attendance_history(
            query.person_id,
            page=page_query.page,
            page_size=page_query.page_size,
            from_at=query.from_at,
            to_at=query.to_at,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class GetAttendanceDailySummaryUseCase:
    def __init__(self, repository: AttendanceRepository) -> None:
        self._repository = repository

    def execute(self, work_date: date) -> AttendanceDailySummaryView:
        return self._repository.get_daily_summary(work_date)
