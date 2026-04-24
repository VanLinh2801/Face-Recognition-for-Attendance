"""Attendance exception transport schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.shared.enums import AttendanceExceptionType
from app.presentation.schemas.common import PaginatedResponse


class AttendanceExceptionItemResponse(BaseModel):
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


class AttendanceExceptionListResponse(PaginatedResponse):
    items: list[AttendanceExceptionItemResponse]


class CreateAttendanceExceptionRequest(BaseModel):
    person_id: UUID
    exception_type: AttendanceExceptionType
    start_at: datetime
    end_at: datetime
    work_date: date
    reason: str = Field(min_length=1)
    notes: str | None = None
    created_by_person_id: UUID


class UpdateAttendanceExceptionRequest(BaseModel):
    exception_type: AttendanceExceptionType | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    work_date: date | None = None
    reason: str | None = Field(default=None, min_length=1)
    notes: str | None = None


class BulkDeleteAttendanceExceptionsRequest(BaseModel):
    exception_ids: list[UUID] = Field(min_length=1)
    deleted_by_person_id: UUID | None = None


class BulkDeleteAttendanceExceptionsResponse(BaseModel):
    deleted_count: int
