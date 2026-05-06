"""SQLAlchemy unknown event repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository
from app.domain.shared.enums import EventDirection, UnknownEventReviewStatus
from app.domain.unknown_events.entities import UnknownEvent
from app.infrastructure.persistence.models.unknown_event_model import UnknownEventModel
from app.infrastructure.persistence.repositories.mappers import to_float


class SqlAlchemyUnknownEventRepository(UnknownEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_unknown_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: UnknownEventReviewStatus | None = None,
    ) -> tuple[list[UnknownEvent], int]:
        stmt = select(UnknownEventModel)
        count_stmt = select(func.count()).select_from(UnknownEventModel)

        if detected_from is not None:
            stmt = stmt.where(UnknownEventModel.detected_at >= detected_from)
            count_stmt = count_stmt.where(UnknownEventModel.detected_at >= detected_from)
        if detected_to is not None:
            stmt = stmt.where(UnknownEventModel.detected_at <= detected_to)
            count_stmt = count_stmt.where(UnknownEventModel.detected_at <= detected_to)
        if review_status is not None:
            stmt = stmt.where(UnknownEventModel.review_status == review_status)
            count_stmt = count_stmt.where(UnknownEventModel.review_status == review_status)

        stmt = stmt.order_by(UnknownEventModel.detected_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                UnknownEvent(
                    id=item.id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    detected_at=item.detected_at,
                    event_direction=item.event_direction,
                    match_score=to_float(item.match_score),
                    spoof_score=to_float(item.spoof_score),
                    event_source=item.event_source,
                    dedupe_key=item.dedupe_key,
                    raw_payload=item.raw_payload,
                    review_status=item.review_status,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total,
        )

    def get_by_dedupe_key(self, dedupe_key: str) -> UnknownEvent | None:
        stmt = select(UnknownEventModel).where(UnknownEventModel.dedupe_key == dedupe_key)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return UnknownEvent(
            id=item.id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            detected_at=item.detected_at,
            event_direction=item.event_direction,
            match_score=to_float(item.match_score),
            spoof_score=to_float(item.spoof_score),
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            review_status=item.review_status,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def list_unknown_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[UnknownEvent]:
        stmt = (
            select(UnknownEventModel)
            .where(UnknownEventModel.detected_at > since_timestamp)
            .order_by(UnknownEventModel.detected_at.asc())
            .limit(limit)
        )
        items = self._session.execute(stmt).scalars().all()
        return [
            UnknownEvent(
                id=item.id,
                snapshot_media_asset_id=item.snapshot_media_asset_id,
                detected_at=item.detected_at,
                event_direction=item.event_direction,
                match_score=to_float(item.match_score),
                spoof_score=to_float(item.spoof_score),
                event_source=item.event_source,
                dedupe_key=item.dedupe_key,
                raw_payload=item.raw_payload,
                review_status=item.review_status,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in items
        ]

    def create_unknown_event(
        self,
        *,
        snapshot_media_asset_id: UUID | None,
        detected_at: datetime,
        event_direction: EventDirection,
        match_score: float | None,
        spoof_score: float | None,
        event_source: str,
        dedupe_key: str,
        review_status: UnknownEventReviewStatus,
        notes: str | None,
        raw_payload: dict | None,
    ) -> UnknownEvent:
        now = datetime.now(timezone.utc)
        item = UnknownEventModel(
            id=uuid4(),
            snapshot_media_asset_id=snapshot_media_asset_id,
            detected_at=detected_at,
            event_direction=event_direction,
            match_score=match_score,
            spoof_score=spoof_score,
            event_source=event_source,
            dedupe_key=dedupe_key,
            raw_payload=raw_payload,
            review_status=review_status,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return UnknownEvent(
            id=item.id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            detected_at=item.detected_at,
            event_direction=item.event_direction,
            match_score=to_float(item.match_score),
            spoof_score=to_float(item.spoof_score),
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            review_status=item.review_status,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
