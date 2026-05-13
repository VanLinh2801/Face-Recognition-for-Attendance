"""SQLAlchemy unified event feed repository."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import String, case, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.event_feed_repository import (
    EventFeedItem,
    EventFeedRepository,
    EventFeedType,
    ReviewStatusFilter,
    SeverityFilter,
)
from app.domain.shared.enums import EventDirection
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel
from app.infrastructure.persistence.models.spoof_alert_event_model import SpoofAlertEventModel
from app.infrastructure.persistence.models.unknown_event_model import UnknownEventModel


class SqlAlchemyEventFeedRepository(EventFeedRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_event_feed(
        self,
        *,
        page: int,
        page_size: int,
        event_type: EventFeedType = EventFeedType.ALL,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        query: str | None = None,
        review_status: ReviewStatusFilter | None = None,
        severity: SeverityFilter | None = None,
    ) -> tuple[list[EventFeedItem], int]:
        feed = self._build_feed_subquery()
        stmt = select(feed)
        count_stmt = select(func.count()).select_from(feed)

        conditions = []
        if event_type != EventFeedType.ALL:
            conditions.append(feed.c.type == event_type.value)
        if from_at is not None:
            conditions.append(feed.c.occurred_at >= from_at)
        if to_at is not None:
            conditions.append(feed.c.occurred_at <= to_at)
        if query:
            normalized_query = f"%{query.strip().lower()}%"
            conditions.append(
                or_(
                    func.lower(feed.c.id).like(normalized_query),
                    func.lower(feed.c.source).like(normalized_query),
                    func.lower(func.coalesce(feed.c.person_name, "")).like(normalized_query),
                )
            )
        if review_status is not None:
            if event_type == EventFeedType.ALL:
                conditions.append(
                    or_(
                        feed.c.type == EventFeedType.RECOGNITION.value,
                        feed.c.review_status == review_status.value,
                    )
                )
            elif event_type != EventFeedType.RECOGNITION:
                conditions.append(feed.c.review_status == review_status.value)
        if severity is not None:
            if event_type == EventFeedType.ALL:
                conditions.append(
                    or_(
                        feed.c.type != EventFeedType.SPOOF.value,
                        feed.c.severity == severity.value,
                    )
                )
            elif event_type == EventFeedType.SPOOF:
                conditions.append(feed.c.severity == severity.value)

        if conditions:
            stmt = stmt.where(*conditions)
            count_stmt = count_stmt.where(*conditions)

        stmt = stmt.order_by(feed.c.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = self._session.execute(stmt).mappings().all()
        total = self._session.execute(count_stmt).scalar_one()
        return ([self._map_row(row) for row in rows], total)

    def _build_feed_subquery(self):
        recognition = (
            select(
                RecognitionEventModel.id.cast(String).label("id"),
                literal(EventFeedType.RECOGNITION.value).label("type"),
                RecognitionEventModel.recognized_at.label("occurred_at"),
                RecognitionEventModel.person_id.cast(String).label("person_id"),
                PersonModel.full_name.label("person_name"),
                RecognitionEventModel.event_direction.cast(String).label("direction"),
                RecognitionEventModel.match_score.label("score"),
                RecognitionEventModel.spoof_score.label("spoof_score"),
                RecognitionEventModel.event_source.label("source"),
                func.coalesce(
                    func.nullif(
                        func.trim(
                            case((RecognitionEventModel.is_valid.is_(True), literal("valid")), else_=RecognitionEventModel.invalid_reason)
                        ),
                        "",
                    ),
                    literal("invalid"),
                ).label("status"),
                literal(None).label("severity"),
                literal(None).label("review_status"),
                RecognitionEventModel.snapshot_media_asset_id.cast(String).label("snapshot_media_asset_id"),
                RecognitionEventModel.raw_payload.label("raw_payload"),
                RecognitionEventModel.face_registration_id.cast(String).label("face_registration_id"),
                literal(None).label("notes"),
                RecognitionEventModel.created_at.label("created_at"),
                literal(None).label("updated_at"),
            )
            .join(PersonModel, PersonModel.id == RecognitionEventModel.person_id, isouter=True)
        )

        unknown = select(
            UnknownEventModel.id.cast(String).label("id"),
            literal(EventFeedType.UNKNOWN.value).label("type"),
            UnknownEventModel.detected_at.label("occurred_at"),
            literal(None).label("person_id"),
            literal("Unknown").label("person_name"),
            UnknownEventModel.event_direction.cast(String).label("direction"),
            UnknownEventModel.match_score.label("score"),
            UnknownEventModel.spoof_score.label("spoof_score"),
            UnknownEventModel.event_source.label("source"),
            UnknownEventModel.review_status.cast(String).label("status"),
            literal(None).label("severity"),
            UnknownEventModel.review_status.cast(String).label("review_status"),
            UnknownEventModel.snapshot_media_asset_id.cast(String).label("snapshot_media_asset_id"),
            UnknownEventModel.raw_payload.label("raw_payload"),
            literal(None).label("face_registration_id"),
            UnknownEventModel.notes.label("notes"),
            UnknownEventModel.created_at.label("created_at"),
            UnknownEventModel.updated_at.label("updated_at"),
        )

        spoof = (
            select(
                SpoofAlertEventModel.id.cast(String).label("id"),
                literal(EventFeedType.SPOOF.value).label("type"),
                SpoofAlertEventModel.detected_at.label("occurred_at"),
                SpoofAlertEventModel.person_id.cast(String).label("person_id"),
                PersonModel.full_name.label("person_name"),
                literal(None).label("direction"),
                SpoofAlertEventModel.spoof_score.label("score"),
                SpoofAlertEventModel.spoof_score.label("spoof_score"),
                SpoofAlertEventModel.event_source.label("source"),
                SpoofAlertEventModel.review_status.cast(String).label("status"),
                SpoofAlertEventModel.severity.cast(String).label("severity"),
                SpoofAlertEventModel.review_status.cast(String).label("review_status"),
                SpoofAlertEventModel.snapshot_media_asset_id.cast(String).label("snapshot_media_asset_id"),
                SpoofAlertEventModel.raw_payload.label("raw_payload"),
                literal(None).label("face_registration_id"),
                SpoofAlertEventModel.notes.label("notes"),
                SpoofAlertEventModel.created_at.label("created_at"),
                SpoofAlertEventModel.updated_at.label("updated_at"),
            )
            .join(PersonModel, PersonModel.id == SpoofAlertEventModel.person_id, isouter=True)
        )

        return union_all(recognition, unknown, spoof).subquery()

    def _map_row(self, row) -> EventFeedItem:
        direction = EventDirection(row["direction"]) if row["direction"] is not None else None
        return EventFeedItem(
            id=UUID(row["id"]),
            type=EventFeedType(row["type"]),
            occurred_at=row["occurred_at"],
            person_id=UUID(row["person_id"]) if row["person_id"] is not None else None,
            person_name=row["person_name"],
            direction=direction,
            score=float(row["score"]) if row["score"] is not None else None,
            spoof_score=float(row["spoof_score"]) if row["spoof_score"] is not None else None,
            source=row["source"],
            status=row["status"],
            severity=row["severity"],
            review_status=row["review_status"],
            snapshot_media_asset_id=UUID(row["snapshot_media_asset_id"]) if row["snapshot_media_asset_id"] is not None else None,
            raw_payload=row["raw_payload"],
            metadata=self._build_metadata(row),
        )

    def _build_metadata(self, row) -> dict[str, object | None]:
        if row["type"] == EventFeedType.RECOGNITION.value:
            return {
                "face_registration_id": row["face_registration_id"],
                "created_at": row["created_at"],
            }
        return {
            "notes": row["notes"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
