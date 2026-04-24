"""SQLAlchemy attendance read repository."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import case, cast, Date, distinct, func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.attendance_repository import AttendanceRepository
from app.domain.shared.enums import EventDirection
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel


@dataclass(slots=True)
class AttendanceEventView:
    id: UUID
    person_id: UUID
    person_full_name: str
    recognized_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    is_valid: bool


@dataclass(slots=True)
class AttendanceSummaryView:
    work_date: date
    total_events: int
    unique_persons: int
    total_entries: int
    total_exits: int


class SqlAlchemyAttendanceRepository(AttendanceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_attendance_events(
        self,
        *,
        page: int,
        page_size: int,
        person_id: UUID | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
    ) -> tuple[list[AttendanceEventView], int]:
        stmt = (
            select(
                RecognitionEventModel.id,
                RecognitionEventModel.person_id,
                PersonModel.full_name,
                RecognitionEventModel.recognized_at,
                RecognitionEventModel.event_direction,
                RecognitionEventModel.match_score,
                RecognitionEventModel.spoof_score,
                RecognitionEventModel.event_source,
                RecognitionEventModel.is_valid,
            )
            .join(PersonModel, PersonModel.id == RecognitionEventModel.person_id)
        )
        count_stmt = select(func.count()).select_from(RecognitionEventModel)
        if person_id is not None:
            stmt = stmt.where(RecognitionEventModel.person_id == person_id)
            count_stmt = count_stmt.where(RecognitionEventModel.person_id == person_id)
        if from_at is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at >= from_at)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at >= from_at)
        if to_at is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at <= to_at)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at <= to_at)

        stmt = stmt.order_by(RecognitionEventModel.recognized_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = self._session.execute(stmt).all()
        total = self._session.execute(count_stmt).scalar_one()
        items = [
            AttendanceEventView(
                id=row.id,
                person_id=row.person_id,
                person_full_name=row.full_name,
                recognized_at=row.recognized_at,
                event_direction=row.event_direction,
                match_score=float(row.match_score) if row.match_score is not None else None,
                spoof_score=float(row.spoof_score) if row.spoof_score is not None else None,
                event_source=row.event_source,
                is_valid=row.is_valid,
            )
            for row in rows
        ]
        return items, total

    def get_attendance_event(self, event_id: UUID) -> AttendanceEventView | None:
        stmt = (
            select(
                RecognitionEventModel.id,
                RecognitionEventModel.person_id,
                PersonModel.full_name,
                RecognitionEventModel.recognized_at,
                RecognitionEventModel.event_direction,
                RecognitionEventModel.match_score,
                RecognitionEventModel.spoof_score,
                RecognitionEventModel.event_source,
                RecognitionEventModel.is_valid,
            )
            .join(PersonModel, PersonModel.id == RecognitionEventModel.person_id)
            .where(RecognitionEventModel.id == event_id)
        )
        row = self._session.execute(stmt).one_or_none()
        if row is None:
            return None
        return AttendanceEventView(
            id=row.id,
            person_id=row.person_id,
            person_full_name=row.full_name,
            recognized_at=row.recognized_at,
            event_direction=row.event_direction,
            match_score=float(row.match_score) if row.match_score is not None else None,
            spoof_score=float(row.spoof_score) if row.spoof_score is not None else None,
            event_source=row.event_source,
            is_valid=row.is_valid,
        )

    def list_person_attendance_history(
        self,
        person_id: UUID,
        *,
        page: int,
        page_size: int,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
    ) -> tuple[list[AttendanceEventView], int]:
        return self.list_attendance_events(
            page=page,
            page_size=page_size,
            person_id=person_id,
            from_at=from_at,
            to_at=to_at,
        )

    def get_daily_summary(self, work_date: date) -> AttendanceSummaryView:
        stmt = select(
            func.count(RecognitionEventModel.id).label("total_events"),
            func.count(distinct(RecognitionEventModel.person_id)).label("unique_persons"),
            func.coalesce(
                func.sum(
                    case((RecognitionEventModel.event_direction == EventDirection.ENTRY, 1), else_=0)
                ),
                0,
            ).label("total_entries"),
            func.coalesce(
                func.sum(
                    case((RecognitionEventModel.event_direction == EventDirection.EXIT, 1), else_=0)
                ),
                0,
            ).label("total_exits"),
        ).where(cast(RecognitionEventModel.recognized_at, Date) == work_date)
        row = self._session.execute(stmt).one()
        return AttendanceSummaryView(
            work_date=work_date,
            total_events=int(row.total_events or 0),
            unique_persons=int(row.unique_persons or 0),
            total_entries=int(row.total_entries or 0),
            total_exits=int(row.total_exits or 0),
        )
