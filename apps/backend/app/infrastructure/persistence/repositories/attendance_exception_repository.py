"""SQLAlchemy attendance exception repository."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.attendance_exception_repository import AttendanceExceptionRepository
from app.domain.attendance_exceptions.entities import AttendanceException
from app.domain.shared.enums import AttendanceExceptionType
from app.infrastructure.persistence.models.attendance_exception_model import AttendanceExceptionModel


def _to_attendance_exception(model: AttendanceExceptionModel) -> AttendanceException:
    return AttendanceException(
        id=model.id,
        person_id=model.person_id,
        exception_type=model.exception_type,
        start_at=model.start_at,
        end_at=model.end_at,
        work_date=model.work_date,
        reason=model.reason,
        notes=model.notes,
        created_by_person_id=model.created_by_person_id,
        is_deleted=model.is_deleted,
        deleted_at=model.deleted_at,
        deleted_by_person_id=model.deleted_by_person_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SqlAlchemyAttendanceExceptionRepository(AttendanceExceptionRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

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
    ) -> AttendanceException:
        now = datetime.now(timezone.utc)
        item = AttendanceExceptionModel(
            person_id=person_id,
            exception_type=exception_type,
            start_at=start_at,
            end_at=end_at,
            work_date=work_date,
            reason=reason,
            notes=notes,
            created_by_person_id=created_by_person_id,
            is_deleted=False,
            deleted_at=None,
            deleted_by_person_id=None,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return _to_attendance_exception(item)

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
    ) -> tuple[list[AttendanceException], int]:
        stmt = select(AttendanceExceptionModel)
        count_stmt = select(func.count()).select_from(AttendanceExceptionModel)
        if not include_deleted:
            stmt = stmt.where(AttendanceExceptionModel.is_deleted.is_(False))
            count_stmt = count_stmt.where(AttendanceExceptionModel.is_deleted.is_(False))
        if person_id is not None:
            stmt = stmt.where(AttendanceExceptionModel.person_id == person_id)
            count_stmt = count_stmt.where(AttendanceExceptionModel.person_id == person_id)
        if exception_type is not None:
            stmt = stmt.where(AttendanceExceptionModel.exception_type == exception_type)
            count_stmt = count_stmt.where(AttendanceExceptionModel.exception_type == exception_type)
        if work_date_from is not None:
            stmt = stmt.where(AttendanceExceptionModel.work_date >= work_date_from)
            count_stmt = count_stmt.where(AttendanceExceptionModel.work_date >= work_date_from)
        if work_date_to is not None:
            stmt = stmt.where(AttendanceExceptionModel.work_date <= work_date_to)
            count_stmt = count_stmt.where(AttendanceExceptionModel.work_date <= work_date_to)
        stmt = stmt.order_by(AttendanceExceptionModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()
        return ([_to_attendance_exception(item) for item in items], total)

    def get_exception(self, exception_id: UUID, *, include_deleted: bool = False) -> AttendanceException | None:
        stmt = select(AttendanceExceptionModel).where(AttendanceExceptionModel.id == exception_id)
        if not include_deleted:
            stmt = stmt.where(AttendanceExceptionModel.is_deleted.is_(False))
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return _to_attendance_exception(item)

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
    ) -> AttendanceException | None:
        item = self._session.get(AttendanceExceptionModel, exception_id)
        if item is None or item.is_deleted:
            return None
        if exception_type is not None:
            item.exception_type = exception_type
        if start_at is not None:
            item.start_at = start_at
        if end_at is not None:
            item.end_at = end_at
        if work_date is not None:
            item.work_date = work_date
        if reason is not None:
            item.reason = reason
        if notes is not None:
            item.notes = notes
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return _to_attendance_exception(item)

    def soft_delete_exception(self, exception_id: UUID, *, deleted_by_person_id: UUID | None = None) -> bool:
        item = self._session.get(AttendanceExceptionModel, exception_id)
        if item is None or item.is_deleted:
            return False
        item.is_deleted = True
        item.deleted_at = datetime.now(timezone.utc)
        item.deleted_by_person_id = deleted_by_person_id
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return True

    def bulk_soft_delete_exceptions(
        self,
        exception_ids: list[UUID],
        *,
        deleted_by_person_id: UUID | None = None,
    ) -> int:
        if not exception_ids:
            return 0
        stmt = select(AttendanceExceptionModel).where(AttendanceExceptionModel.id.in_(exception_ids))
        items = self._session.execute(stmt).scalars().all()
        now = datetime.now(timezone.utc)
        count = 0
        for item in items:
            if item.is_deleted:
                continue
            item.is_deleted = True
            item.deleted_at = now
            item.deleted_by_person_id = deleted_by_person_id
            item.updated_at = now
            count += 1
        self._session.flush()
        return count
