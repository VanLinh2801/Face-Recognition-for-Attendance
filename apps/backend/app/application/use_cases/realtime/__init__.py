"""Realtime catch-up use case."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.application.interfaces.repositories.face_registration_repository import FaceRegistrationRepository
from app.application.interfaces.repositories.recognition_event_repository import RecognitionEventRepository
from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository


@dataclass(slots=True, kw_only=True)
class RealtimeCatchupQuery:
    channel: RealtimeChannel
    since_timestamp: datetime
    limit: int = 200


class GetRealtimeCatchupUseCase:
    def __init__(
        self,
        recognition_repository: RecognitionEventRepository,
        unknown_repository: UnknownEventRepository,
        spoof_repository: SpoofAlertEventRepository,
        face_registration_repository: FaceRegistrationRepository,
    ) -> None:
        self._recognition_repository = recognition_repository
        self._unknown_repository = unknown_repository
        self._spoof_repository = spoof_repository
        self._face_registration_repository = face_registration_repository

    def execute(self, query: RealtimeCatchupQuery) -> list[RealtimeEnvelope]:
        if query.channel != RealtimeChannel.EVENTS_BUSINESS:
            return []

        recognition_events = self._recognition_repository.list_recognition_events_since(
            since_timestamp=query.since_timestamp,
            limit=query.limit,
        )
        unknown_events = self._unknown_repository.list_unknown_events_since(
            since_timestamp=query.since_timestamp,
            limit=query.limit,
        )
        spoof_events = self._spoof_repository.list_spoof_alert_events_since(
            since_timestamp=query.since_timestamp,
            limit=query.limit,
        )
        registration_events = self._face_registration_repository.list_registrations_completed_since(
            since_timestamp=query.since_timestamp,
            limit=query.limit,
        )

        envelopes: list[RealtimeEnvelope] = []
        for item in recognition_events:
            envelopes.append(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="recognition_event.detected",
                    occurred_at=item.recognized_at,
                    correlation_id=None,
                    dedupe_key=item.dedupe_key or None,
                    payload={
                        "id": str(item.id),
                        "person_id": str(item.person_id),
                        "face_registration_id": str(item.face_registration_id),
                        "recognized_at": item.recognized_at.isoformat(),
                        "event_direction": item.event_direction.value,
                        "match_score": item.match_score,
                        "spoof_score": item.spoof_score,
                        "event_source": item.event_source,
                    },
                    metadata={"source": "catchup"},
                )
            )
        for item in unknown_events:
            payload: dict[str, Any] = {
                "id": str(item.id),
                "detected_at": item.detected_at.isoformat(),
                "event_direction": item.event_direction.value,
                "match_score": item.match_score,
                "spoof_score": item.spoof_score,
                "event_source": item.event_source,
                "review_status": item.review_status.value,
                "notes": item.notes,
            }
            if item.snapshot_media_asset_id is not None:
                payload["snapshot_media_asset_id"] = str(item.snapshot_media_asset_id)
            envelopes.append(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="unknown_event.detected",
                    occurred_at=item.detected_at,
                    correlation_id=None,
                    dedupe_key=item.dedupe_key or None,
                    payload=payload,
                    metadata={"source": "catchup"},
                )
            )
        for item in spoof_events:
            payload: dict[str, Any] = {
                "id": str(item.id),
                "detected_at": item.detected_at.isoformat(),
                "spoof_score": item.spoof_score,
                "event_source": item.event_source,
                "severity": item.severity.value,
                "review_status": item.review_status.value,
                "notes": item.notes,
            }
            if item.person_id is not None:
                payload["person_id"] = str(item.person_id)
            if item.snapshot_media_asset_id is not None:
                payload["snapshot_media_asset_id"] = str(item.snapshot_media_asset_id)
            envelopes.append(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="spoof_alert.detected",
                    occurred_at=item.detected_at,
                    correlation_id=None,
                    dedupe_key=item.dedupe_key or None,
                    payload=payload,
                    metadata={"source": "catchup"},
                )
            )

        for item in registration_events:
            payload: dict[str, Any] = {
                "id": str(item.id),
                "person_id": str(item.person_id),
                "source_media_asset_id": str(item.source_media_asset_id),
                "face_image_media_asset_id": str(item.face_image_media_asset_id)
                if item.face_image_media_asset_id is not None
                else None,
                "registration_status": item.registration_status.value,
                "validation_notes": item.validation_notes,
                "embedding_model": item.embedding_model,
                "embedding_version": item.embedding_version,
                "is_active": item.is_active,
                "indexed_at": item.indexed_at.isoformat() if item.indexed_at is not None else None,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
            }
            envelopes.append(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="registration_processing.completed",
                    occurred_at=item.updated_at,
                    correlation_id=None,
                    dedupe_key=str(item.id),
                    payload=payload,
                    metadata={"source": "catchup"},
                )
            )

        envelopes.sort(key=lambda item: item.occurred_at)
        return envelopes[: query.limit]
