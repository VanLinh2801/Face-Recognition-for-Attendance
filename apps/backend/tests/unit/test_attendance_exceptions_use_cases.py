from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.attendance_exceptions import (
    CreateAttendanceExceptionCommand,
    CreateAttendanceExceptionUseCase,
)
from app.core.exceptions import ValidationError
from app.domain.attendance_exceptions.entities import AttendanceException
from app.domain.shared.enums import AttendanceExceptionType


class _FakeAttendanceExceptionRepository:
    def create_exception(self, **kwargs):
        now = datetime.now(timezone.utc)
        return AttendanceException(
            id=uuid4(),
            person_id=kwargs["person_id"],
            exception_type=kwargs["exception_type"],
            start_at=kwargs["start_at"],
            end_at=kwargs["end_at"],
            work_date=kwargs["work_date"],
            reason=kwargs["reason"],
            notes=kwargs["notes"],
            created_by_person_id=kwargs["created_by_person_id"],
            is_deleted=False,
            deleted_at=None,
            deleted_by_person_id=None,
            created_at=now,
            updated_at=now,
        )


def test_create_attendance_exception_validates_time_range():
    repo = _FakeAttendanceExceptionRepository()
    use_case = CreateAttendanceExceptionUseCase(repo)
    start = datetime.now(timezone.utc)
    end = start - timedelta(hours=1)
    with pytest.raises(ValidationError):
        use_case.execute(
            CreateAttendanceExceptionCommand(
                person_id=uuid4(),
                exception_type=AttendanceExceptionType.BUSINESS_TRIP,
                start_at=start,
                end_at=end,
                work_date=date.today(),
                reason="Trip",
                notes=None,
                created_by_person_id=uuid4(),
            )
        )


def test_create_attendance_exception_success():
    repo = _FakeAttendanceExceptionRepository()
    use_case = CreateAttendanceExceptionUseCase(repo)
    start = datetime.now(timezone.utc)
    end = start + timedelta(hours=8)
    item = use_case.execute(
        CreateAttendanceExceptionCommand(
            person_id=uuid4(),
            exception_type=AttendanceExceptionType.BUSINESS_TRIP,
            start_at=start,
            end_at=end,
            work_date=start.date(),
            reason="Trip",
            notes=None,
            created_by_person_id=uuid4(),
        )
    )
    assert item.is_deleted is False
