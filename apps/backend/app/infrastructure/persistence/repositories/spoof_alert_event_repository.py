"""SQLAlchemy spoof alert event repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.domain.shared.enums import SpoofReviewStatus, SpoofSeverity
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.infrastructure.persistence.models.spoof_alert_event_model import SpoofAlertEventModel
from app.infrastructure.persistence.repositories.mappers import to_float


class SqlAlchemySpoofAlertEventRepository(SpoofAlertEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_spoof_alert_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: SpoofReviewStatus | None = None,
    ) -> tuple[list[SpoofAlertEvent], int]:
        stmt = select(SpoofAlertEventModel)
        count_stmt = select(func.count()).select_from(SpoofAlertEventModel)

        if detected_from is not None:
            stmt = stmt.where(SpoofAlertEventModel.detected_at >= detected_from)
            count_stmt = count_stmt.where(SpoofAlertEventModel.detected_at >= detected_from)
        if detected_to is not None:
            stmt = stmt.where(SpoofAlertEventModel.detected_at <= detected_to)
            count_stmt = count_stmt.where(SpoofAlertEventModel.detected_at <= detected_to)
        if review_status is not None:
            stmt = stmt.where(SpoofAlertEventModel.review_status == review_status)
            count_stmt = count_stmt.where(SpoofAlertEventModel.review_status == review_status)

        stmt = stmt.order_by(SpoofAlertEventModel.detected_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                SpoofAlertEvent(
                    id=item.id,
                    person_id=item.person_id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    detected_at=item.detected_at,
                    spoof_score=to_float(item.spoof_score) or 0.0,
                    event_source=item.event_source,
                    dedupe_key=item.dedupe_key,
                    raw_payload=item.raw_payload,
                    severity=item.severity,
                    review_status=item.review_status,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total,
        )

    def get_by_dedupe_key(self, dedupe_key: str) -> SpoofAlertEvent | None:
        stmt = select(SpoofAlertEventModel).where(SpoofAlertEventModel.dedupe_key == dedupe_key)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return SpoofAlertEvent(
            id=item.id,
            person_id=item.person_id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            detected_at=item.detected_at,
            spoof_score=to_float(item.spoof_score) or 0.0,
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            severity=item.severity,
            review_status=item.review_status,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def list_spoof_alert_events_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[SpoofAlertEvent]:
        stmt = (
            select(SpoofAlertEventModel)
            .where(SpoofAlertEventModel.detected_at > since_timestamp)
            .order_by(SpoofAlertEventModel.detected_at.asc())
            .limit(limit)
        )
        items = self._session.execute(stmt).scalars().all()
        return [
            SpoofAlertEvent(
                id=item.id,
                person_id=item.person_id,
                snapshot_media_asset_id=item.snapshot_media_asset_id,
                detected_at=item.detected_at,
                spoof_score=to_float(item.spoof_score) or 0.0,
                event_source=item.event_source,
                dedupe_key=item.dedupe_key,
                raw_payload=item.raw_payload,
                severity=item.severity,
                review_status=item.review_status,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in items
        ]

    def get_latest_spoof_time(self, *, person_id: UUID) -> datetime | None:
        stmt = (
            select(SpoofAlertEventModel.detected_at)
            .where(SpoofAlertEventModel.person_id == person_id)
            .order_by(SpoofAlertEventModel.detected_at.desc())
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def create_spoof_alert_event(
        self,
        *,
        person_id: UUID | None,
        snapshot_media_asset_id: UUID | None,
        detected_at: datetime,
        spoof_score: float,
        event_source: str,
        dedupe_key: str,
        severity: SpoofSeverity,
        review_status: SpoofReviewStatus,
        notes: str | None,
        raw_payload: dict | None,
    ) -> SpoofAlertEvent:
        now = datetime.now(timezone.utc)
        item = SpoofAlertEventModel(
            person_id=person_id,
            snapshot_media_asset_id=snapshot_media_asset_id,
            detected_at=detected_at,
            spoof_score=spoof_score,
            event_source=event_source,
            dedupe_key=dedupe_key,
            raw_payload=raw_payload,
            severity=severity,
            review_status=review_status,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return SpoofAlertEvent(
            id=item.id,
            person_id=item.person_id,
            snapshot_media_asset_id=item.snapshot_media_asset_id,
            detected_at=item.detected_at,
            spoof_score=to_float(item.spoof_score) or 0.0,
            event_source=item.event_source,
            dedupe_key=item.dedupe_key,
            raw_payload=item.raw_payload,
            severity=item.severity,
            review_status=item.review_status,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
