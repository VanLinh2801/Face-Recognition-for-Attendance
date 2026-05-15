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
from app.infrastructure.persistence.models.spoof_alert_event_model import SpoofAlertEventModel
from app.infrastructure.persistence.models.unknown_event_model import UnknownEventModel


@dataclass(slots=True)
class AttendanceEventView:
    id: UUID
    person_id: UUID
    person_full_name: str
    snapshot_media_asset_id: UUID | None
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
    unknown_count: int
    spoof_alert_count: int


@dataclass(slots=True)
class AttendanceHourlyStatView:
    hour: str
    events: int
    entries: int
    exits: int
    alerts: int


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
                RecognitionEventModel.snapshot_media_asset_id,
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
                snapshot_media_asset_id=row.snapshot_media_asset_id,
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
                RecognitionEventModel.snapshot_media_asset_id,
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
            snapshot_media_asset_id=row.snapshot_media_asset_id,
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
        unknown_count_subquery = (
            select(func.count(UnknownEventModel.id))
            .where(cast(UnknownEventModel.detected_at, Date) == work_date)
            .scalar_subquery()
        )
        spoof_count_subquery = (
            select(func.count(SpoofAlertEventModel.id))
            .where(cast(SpoofAlertEventModel.detected_at, Date) == work_date)
            .scalar_subquery()
        )
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
            func.coalesce(unknown_count_subquery, 0).label("unknown_count"),
            func.coalesce(spoof_count_subquery, 0).label("spoof_alert_count"),
        ).where(cast(RecognitionEventModel.recognized_at, Date) == work_date)
        row = self._session.execute(stmt).one()
        return AttendanceSummaryView(
            work_date=work_date,
            total_events=int(row.total_events or 0),
            unique_persons=int(row.unique_persons or 0),
            total_entries=int(row.total_entries or 0),
            total_exits=int(row.total_exits or 0),
            unknown_count=int(row.unknown_count or 0),
            spoof_alert_count=int(row.spoof_alert_count or 0),
        )

    def get_hourly_stats(self, work_date: date) -> list[AttendanceHourlyStatView]:
        recognition_stmt = (
            select(
                func.extract("hour", RecognitionEventModel.recognized_at).label("hour"),
                func.count(RecognitionEventModel.id).label("events"),
                func.coalesce(
                    func.sum(case((RecognitionEventModel.event_direction == EventDirection.ENTRY, 1), else_=0)),
                    0,
                ).label("entries"),
                func.coalesce(
                    func.sum(case((RecognitionEventModel.event_direction == EventDirection.EXIT, 1), else_=0)),
                    0,
                ).label("exits"),
            )
            .where(
                cast(RecognitionEventModel.recognized_at, Date) == work_date,
                RecognitionEventModel.is_valid.is_(True),
            )
            .group_by(func.extract("hour", RecognitionEventModel.recognized_at))
        )
        unknown_stmt = (
            select(
                func.extract("hour", UnknownEventModel.detected_at).label("hour"),
                func.count(UnknownEventModel.id).label("alerts"),
            )
            .where(cast(UnknownEventModel.detected_at, Date) == work_date)
            .group_by(func.extract("hour", UnknownEventModel.detected_at))
        )
        spoof_stmt = (
            select(
                func.extract("hour", SpoofAlertEventModel.detected_at).label("hour"),
                func.count(SpoofAlertEventModel.id).label("alerts"),
            )
            .where(cast(SpoofAlertEventModel.detected_at, Date) == work_date)
            .group_by(func.extract("hour", SpoofAlertEventModel.detected_at))
        )

        recognition_rows = self._session.execute(recognition_stmt).all()
        unknown_rows = self._session.execute(unknown_stmt).all()
        spoof_rows = self._session.execute(spoof_stmt).all()

        buckets = {
            hour: AttendanceHourlyStatView(
                hour=f"{hour:02d}:00",
                events=0,
                entries=0,
                exits=0,
                alerts=0,
            )
            for hour in range(24)
        }

        for row in recognition_rows:
            hour = int(row.hour)
            buckets[hour].events = int(row.events or 0)
            buckets[hour].entries = int(row.entries or 0)
            buckets[hour].exits = int(row.exits or 0)

        for row in unknown_rows:
            hour = int(row.hour)
            buckets[hour].alerts += int(row.alerts or 0)

        for row in spoof_rows:
            hour = int(row.hour)
            buckets[hour].alerts += int(row.alerts or 0)

        return [buckets[hour] for hour in range(24)]
