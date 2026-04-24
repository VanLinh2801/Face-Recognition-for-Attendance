"""Attendance exception repository abstraction."""

from __future__ import annotations

from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from app.domain.attendance_exceptions.entities import AttendanceException
from app.domain.shared.enums import AttendanceExceptionType


class AttendanceExceptionRepository(Protocol):
    def create_exception(
        self,
        *,
        person_id: UUID,
        exception_type: AttendanceExceptionType,
        start_at: datetime,
        end_at: datetime,
        work_date: date,
        reason: str,
        notes: str | None,
        created_by_person_id: UUID,
    ) -> AttendanceException: ...

    def list_exceptions(
        self,
        *,
        page: int,
        page_size: int,
        person_id: UUID | None = None,
        exception_type: AttendanceExceptionType | None = None,
        work_date_from: date | None = None,
        work_date_to: date | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[AttendanceException], int]: ...

    def get_exception(self, exception_id: UUID, *, include_deleted: bool = False) -> AttendanceException | None: ...

    def update_exception(
        self,
        exception_id: UUID,
        *,
        exception_type: AttendanceExceptionType | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        work_date: date | None = None,
        reason: str | None = None,
        notes: str | None = None,
    ) -> AttendanceException | None: ...

    def soft_delete_exception(self, exception_id: UUID, *, deleted_by_person_id: UUID | None = None) -> bool: ...

    def bulk_soft_delete_exceptions(
        self,
        exception_ids: list[UUID],
        *,
        deleted_by_person_id: UUID | None = None,
    ) -> int: ...
