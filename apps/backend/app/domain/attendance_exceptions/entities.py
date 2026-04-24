"""Attendance exception domain entities."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.domain.shared.enums import AttendanceExceptionType


@dataclass(slots=True, kw_only=True)
class AttendanceException:
    id: UUID
    person_id: UUID
    exception_type: AttendanceExceptionType
    start_at: datetime
    end_at: datetime
    work_date: date
    reason: str
    notes: str | None
    created_by_person_id: UUID
    is_deleted: bool
    deleted_at: datetime | None
    deleted_by_person_id: UUID | None
    created_at: datetime
    updated_at: datetime
