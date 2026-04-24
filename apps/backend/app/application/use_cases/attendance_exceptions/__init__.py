"""Attendance exception use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.attendance_exception_repository import AttendanceExceptionRepository
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.attendance_exceptions.entities import AttendanceException
from app.domain.shared.enums import AttendanceExceptionType


@dataclass(slots=True, kw_only=True)
class CreateAttendanceExceptionCommand:
    person_id: UUID
    exception_type: AttendanceExceptionType
    start_at: datetime
    end_at: datetime
    work_date: date
    reason: str
    notes: str | None
    created_by_person_id: UUID


@dataclass(slots=True, kw_only=True)
class ListAttendanceExceptionsQuery:
    page: int = 1
    page_size: int = 20
    person_id: UUID | None = None
    exception_type: AttendanceExceptionType | None = None
    work_date_from: date | None = None
    work_date_to: date | None = None


@dataclass(slots=True, kw_only=True)
class UpdateAttendanceExceptionCommand:
    exception_id: UUID
    exception_type: AttendanceExceptionType | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    work_date: date | None = None
    reason: str | None = None
    notes: str | None = None


class CreateAttendanceExceptionUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, command: CreateAttendanceExceptionCommand) -> AttendanceException:
        if command.end_at < command.start_at:
            raise ValidationError("end_at must be greater than or equal to start_at")
        if command.work_date < command.start_at.date() or command.work_date > command.end_at.date():
            raise ValidationError("work_date must be within start_at and end_at range")
        return self._repository.create_exception(
            person_id=command.person_id,
            exception_type=command.exception_type,
            start_at=command.start_at,
            end_at=command.end_at,
            work_date=command.work_date,
            reason=command.reason,
            notes=command.notes,
            created_by_person_id=command.created_by_person_id,
        )


class ListAttendanceExceptionsUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, query: ListAttendanceExceptionsQuery) -> PageResult[AttendanceException]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_exceptions(
            page=page_query.page,
            page_size=page_query.page_size,
            person_id=query.person_id,
            exception_type=query.exception_type,
            work_date_from=query.work_date_from,
            work_date_to=query.work_date_to,
            include_deleted=False,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class GetAttendanceExceptionUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, exception_id: UUID) -> AttendanceException:
        item = self._repository.get_exception(exception_id, include_deleted=False)
        if item is None:
            raise NotFoundError("Attendance exception not found")
        return item


class UpdateAttendanceExceptionUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, command: UpdateAttendanceExceptionCommand) -> AttendanceException:
        if command.start_at is not None and command.end_at is not None and command.end_at < command.start_at:
            raise ValidationError("end_at must be greater than or equal to start_at")
        item = self._repository.update_exception(
            command.exception_id,
            exception_type=command.exception_type,
            start_at=command.start_at,
            end_at=command.end_at,
            work_date=command.work_date,
            reason=command.reason,
            notes=command.notes,
        )
        if item is None:
            raise NotFoundError("Attendance exception not found")
        return item


class DeleteAttendanceExceptionUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, exception_id: UUID, *, deleted_by_person_id: UUID | None = None) -> None:
        ok = self._repository.soft_delete_exception(exception_id, deleted_by_person_id=deleted_by_person_id)
        if not ok:
            raise NotFoundError("Attendance exception not found")


class BulkDeleteAttendanceExceptionsUseCase:
    def __init__(self, repository: AttendanceExceptionRepository) -> None:
        self._repository = repository

    def execute(self, exception_ids: list[UUID], *, deleted_by_person_id: UUID | None = None) -> int:
        if not exception_ids:
            raise ValidationError("exception_ids cannot be empty")
        return self._repository.bulk_soft_delete_exceptions(exception_ids, deleted_by_person_id=deleted_by_person_id)
