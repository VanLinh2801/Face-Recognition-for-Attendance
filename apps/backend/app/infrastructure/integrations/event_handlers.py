"""Backend event handlers for Redis-delivered integration events."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.application.use_cases.event_ingestion import IngestStatus
from app.application.use_cases.face_registrations import (
    ApplyRegistrationInputValidationUseCase,
    CompleteFaceRegistrationUseCase,
    RegistrationCompletedCommand,
    RegistrationInputValidatedCommand,
)
from app.bootstrap.container import Container
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus
from app.core.exceptions import ValidationError
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer

logger = logging.getLogger(__name__)


class BackendEventHandlers:
    """Grouped integration handlers to keep main.py focused on app wiring."""

    def __init__(self, container: Container) -> None:
        self._container = container

    async def handle_recognition_event(self, envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        with self._container.session_factory() as session:
            uow = self._container.create_uow(session)
            use_case = self._container.build_ingest_recognition_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await self._container.realtime_event_bus.publish(
                    self._to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="recognition_event.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest recognition result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    async def handle_unknown_event(self, envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        with self._container.session_factory() as session:
            uow = self._container.create_uow(session)
            use_case = self._container.build_ingest_unknown_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await self._container.realtime_event_bus.publish(
                    self._to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="unknown_event.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest unknown result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    async def handle_spoof_alert(self, envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        with self._container.session_factory() as session:
            uow = self._container.create_uow(session)
            use_case = self._container.build_ingest_spoof_alert_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await self._container.realtime_event_bus.publish(
                    self._to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="spoof_alert.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest spoof result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    async def handle_frame_analysis_updated(self, envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        await self._container.realtime_event_bus.publish(
            self._to_realtime_envelope(
                channel=RealtimeChannel.STREAM_OVERLAY,
                event_type="frame_analysis.updated",
                envelope=envelope,
            )
        )
        return True

    async def handle_stream_health_updated(self, envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        await self._container.realtime_event_bus.publish(
            self._to_realtime_envelope(
                channel=RealtimeChannel.STREAM_HEALTH,
                event_type="stream.health.updated",
                envelope=envelope,
            )
        )
        return True

    async def handle_registration_processing_completed(self, envelope: dict[str, Any], payload: dict[str, Any]) -> bool:
        with self._container.session_factory() as session:
            use_case: CompleteFaceRegistrationUseCase = self._container.build_complete_face_registration_use_case(session)
            registration = use_case.execute(
                RegistrationCompletedCommand(
                    registration_id=self._as_uuid(payload, "registration_id"),
                    status=RegistrationStatus(self._required_str(payload, "status")),
                    validation_notes=self._as_optional_str(payload, "validation_notes"),
                    embedding_model=self._as_optional_str(payload, "embedding_model"),
                    embedding_version=self._as_optional_str(payload, "embedding_version"),
                    face_image_media_asset=payload.get("face_image_media_asset"),
                )
            )
            session.commit()
            await self._container.realtime_event_bus.publish(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="registration_processing.completed",
                    occurred_at=self._parse_occurred_at(envelope),
                    correlation_id=self._as_optional_str(envelope, "correlation_id"),
                    dedupe_key=str(registration.id),
                    payload=self._serialize_registration(registration),
                    metadata={
                        "message_id": envelope.get("message_id"),
                        "producer": envelope.get("producer"),
                        "source": "redis-consumer",
                    },
                )
            )
        return True

    async def handle_registration_input_validated(self, envelope: dict[str, Any], payload: dict[str, Any]) -> bool:
        with self._container.session_factory() as session:
            use_case: ApplyRegistrationInputValidationUseCase = (
                self._container.build_apply_registration_input_validation_use_case(session)
            )
            registration = use_case.execute(
                RegistrationInputValidatedCommand(
                    registration_id=self._as_uuid(payload, "registration_id"),
                    status=self._required_str(payload, "status"),
                    validation_notes=self._build_validation_notes(payload),
                    prepared_face_media_asset=payload.get("prepared_face_media_asset"),
                )
            )
            session.commit()
            websocket_payload = {
                "registration_id": str(registration.id),
                "person_id": str(registration.person_id),
                "status": self._required_str(payload, "status"),
                "registration_status": registration.registration_status.value,
                "validated_at": self._required_str(payload, "validated_at"),
                "validation_notes": registration.validation_notes,
                "face_image_media_asset_id": (
                    str(registration.face_image_media_asset_id) if registration.face_image_media_asset_id else None
                ),
            }
            await self._container.realtime_event_bus.publish(
                RealtimeEnvelope(
                    channel=RealtimeChannel.EVENTS_BUSINESS,
                    event_type="registration_input.validated",
                    occurred_at=self._parse_occurred_at(envelope),
                    correlation_id=self._as_optional_str(envelope, "correlation_id"),
                    dedupe_key=str(registration.id),
                    payload=websocket_payload,
                    metadata={
                        "message_id": envelope.get("message_id"),
                        "producer": envelope.get("producer"),
                        "source": "redis-consumer",
                    },
                )
            )
        return True

    @staticmethod
    def _to_realtime_envelope(*, channel: RealtimeChannel, event_type: str, envelope: dict[str, Any]) -> RealtimeEnvelope:
        payload = envelope.get("payload", {})
        dedupe_key = payload.get("dedupe_key") if isinstance(payload, dict) else None
        return RealtimeEnvelope(
            channel=channel,
            event_type=event_type,
            occurred_at=BackendEventHandlers._parse_occurred_at(envelope),
            correlation_id=BackendEventHandlers._as_optional_str(envelope, "correlation_id"),
            dedupe_key=dedupe_key if isinstance(dedupe_key, str) else None,
            payload=payload if isinstance(payload, dict) else {},
            metadata={"message_id": envelope.get("message_id"), "producer": envelope.get("producer")},
        )

    @staticmethod
    def _parse_occurred_at(envelope: dict[str, Any]) -> datetime:
        raw_occurred_at = envelope.get("occurred_at")
        occurred_at = datetime.now(timezone.utc)
        if isinstance(raw_occurred_at, str):
            try:
                occurred_at = datetime.fromisoformat(raw_occurred_at.replace("Z", "+00:00"))
            except ValueError:
                pass
        return occurred_at

    @staticmethod
    def _required_str(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValidationError(f"Missing required field: {key}", details={"field": key})
        return value

    @staticmethod
    def _as_optional_str(payload: dict[str, Any], key: str) -> str | None:
        value = payload.get(key)
        return value if isinstance(value, str) and value.strip() else None

    @staticmethod
    def _as_uuid(payload: dict[str, Any], key: str) -> UUID:
        value = BackendEventHandlers._required_str(payload, key)
        try:
            return UUID(value)
        except ValueError as exc:
            raise ValidationError(f"Invalid UUID field: {key}", details={"field": key}) from exc

    @staticmethod
    def _build_validation_notes(payload: dict[str, Any]) -> str | None:
        pieces = [payload.get("validation_notes"), payload.get("failure_code"), payload.get("failure_message")]
        text_parts = [str(item).strip() for item in pieces if isinstance(item, str) and item.strip()]
        return " | ".join(text_parts) if text_parts else None

    @staticmethod
    def _serialize_registration(registration: PersonFaceRegistration) -> dict[str, Any]:
        return {
            "id": str(registration.id),
            "person_id": str(registration.person_id),
            "source_media_asset_id": str(registration.source_media_asset_id),
            "face_image_media_asset_id": (
                str(registration.face_image_media_asset_id) if registration.face_image_media_asset_id is not None else None
            ),
            "registration_status": registration.registration_status.value,
            "validation_notes": registration.validation_notes,
            "embedding_model": registration.embedding_model,
            "embedding_version": registration.embedding_version,
            "is_active": registration.is_active,
            "indexed_at": registration.indexed_at.isoformat() if registration.indexed_at is not None else None,
            "created_at": registration.created_at.isoformat(),
            "updated_at": registration.updated_at.isoformat(),
        }


def register_backend_event_handlers(consumer: RedisEventConsumer, handlers: BackendEventHandlers) -> None:
    """Register all backend event handlers on the Redis consumer."""

    consumer.register_handler("recognition_event.detected", handlers.handle_recognition_event)
    consumer.register_handler("unknown_event.detected", handlers.handle_unknown_event)
    consumer.register_handler("spoof_alert.detected", handlers.handle_spoof_alert)
    consumer.register_handler("frame_analysis.updated", handlers.handle_frame_analysis_updated)
    consumer.register_handler("stream.health.updated", handlers.handle_stream_health_updated)
    consumer.register_handler("registration_processing.completed", handlers.handle_registration_processing_completed)
    consumer.register_handler("registration_input.validated", handlers.handle_registration_input_validated)
