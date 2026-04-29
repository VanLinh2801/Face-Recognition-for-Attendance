"""SQLAlchemy recognition event repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select  # type: ignore[import-not-found]
from sqlalchemy.orm import Session  # type: ignore[import-not-found]

from app.application.interfaces.repositories.recognition_event_repository import RecognitionEventRepository
from app.domain.recognition_events.entities import RecognitionEvent
from app.domain.shared.enums import EventDirection
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel
from app.infrastructure.persistence.repositories.mappers import to_float


class SqlAlchemyRecognitionEventRepository(RecognitionEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_recognition_events(
        self,
        *,
        page: int,
        page_size: int,
        recognized_from: datetime | None = None,
        recognized_to: datetime | None = None,
    ) -> tuple[list[RecognitionEvent], int]:
        stmt = select(RecognitionEventModel)
        count_stmt = select(func.count()).select_from(RecognitionEventModel)

        if recognized_from is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at >= recognized_from)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at >= recognized_from)
        if recognized_to is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at <= recognized_to)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at <= recognized_to)

        stmt = stmt.order_by(RecognitionEventModel.recognized_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                RecognitionEvent(
                    id=item.id,
                    person_id=item.person_id,
                    face_registration_id=item.face_registration_id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    recognized_at=item.recognized_at,
                    event_direction=item.event_direction,
                    match_score=to_float(item.match_score),
                    spoof_score=to_float(item.spoof_score),
                    event_source=item.event_source,
                    dedupe_key=item.dedupe_key,
                    raw_payload=item.raw_payload,
                    is_valid=item.is_valid,
                    invalid_reason=item.invalid_reason,
                    created_at=item.created_at,
                )
                for item in items
            ],
            total,
        )

    def get_by_dedupe_key(self, dedupe_key: str) -> RecognitionEvent | None:
        stmt = select(RecognitionEventModel).where(RecognitionEventModel.dedupe_key == dedupe_key)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return RecognitionEvent(
            id=item.id,
            person_id=item.person_id,
            face_registration_id=item.face_registration_id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            recognized_at=item.recognized_at,
            event_direction=item.event_direction,
            match_score=to_float(item.match_score),
            spoof_score=to_float(item.spoof_score),
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            is_valid=item.is_valid,
            invalid_reason=item.invalid_reason,
            created_at=item.created_at,
        )

    def list_recognition_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[RecognitionEvent]:
        stmt = (
            select(RecognitionEventModel)
            .where(RecognitionEventModel.recognized_at > since_timestamp)
            .order_by(RecognitionEventModel.recognized_at.asc())
            .limit(limit)
        )
        items = self._session.execute(stmt).scalars().all()
        return [
            RecognitionEvent(
                id=item.id,
                person_id=item.person_id,
                face_registration_id=item.face_registration_id,
                snapshot_media_asset_id=item.snapshot_media_asset_id,
                recognized_at=item.recognized_at,
                event_direction=item.event_direction,
                match_score=to_float(item.match_score),
                spoof_score=to_float(item.spoof_score),
                event_source=item.event_source,
                dedupe_key=item.dedupe_key,
                raw_payload=item.raw_payload,
                is_valid=item.is_valid,
                invalid_reason=item.invalid_reason,
                created_at=item.created_at,
            )
            for item in items
        ]

    def get_latest_recognition_time(self, *, person_id: UUID) -> datetime | None:
        stmt = (
            select(RecognitionEventModel.recognized_at)
            .where(RecognitionEventModel.person_id == person_id)
            .order_by(RecognitionEventModel.recognized_at.desc())
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def create_recognition_event(
        self,
        *,
        person_id: UUID,
        face_registration_id: UUID,
        snapshot_media_asset_id: UUID | None,
        recognized_at: datetime,
        event_direction: EventDirection,
        match_score: float | None,
        spoof_score: float | None,
        event_source: str,
        dedupe_key: str,
        raw_payload: dict | None,
    ) -> RecognitionEvent:
        item = RecognitionEventModel(
            person_id=person_id,
            face_registration_id=face_registration_id,
            snapshot_media_asset_id=snapshot_media_asset_id,
            recognized_at=recognized_at,
            event_direction=event_direction,
            match_score=match_score,
            spoof_score=spoof_score,
            event_source=event_source,
            dedupe_key=dedupe_key,
            raw_payload=raw_payload,
            is_valid=True,
            invalid_reason=None,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(item)
        self._session.flush()
        return RecognitionEvent(
            id=item.id,
            person_id=item.person_id,
            face_registration_id=item.face_registration_id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            recognized_at=item.recognized_at,
            event_direction=item.event_direction,
            match_score=to_float(item.match_score),
            spoof_score=to_float(item.spoof_score),
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            is_valid=item.is_valid,
            invalid_reason=item.invalid_reason,
            created_at=item.created_at,
        )
