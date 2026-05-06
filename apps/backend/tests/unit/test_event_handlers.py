from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.dtos.realtime import RealtimeChannel
from app.application.use_cases.event_ingestion import IngestResult, IngestStatus
from app.core.exceptions import ValidationError
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus
from app.infrastructure.integrations.event_handlers import BackendEventHandlers


class _FakeSession:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None

    def commit(self):
        return None


class _FakeSessionFactory:
    def __call__(self):
        return _FakeSession()


class _FakeBus:
    def __init__(self) -> None:
        self.published: list = []

    async def publish(self, envelope):
        self.published.append(envelope)


class _FakeIngestUseCase:
    def __init__(self, status: IngestStatus) -> None:
        self._status = status

    def execute(self, _envelope):
        return IngestResult(status=self._status)


class _FakeRegistrationValidationUseCase:
    def __init__(self, status: RegistrationStatus = RegistrationStatus.PENDING, notes: str | None = "accepted") -> None:
        self._status = status
        self._notes = notes

    def execute(self, _command):
        now = datetime.now(timezone.utc)
        return PersonFaceRegistration(
            id=uuid4(),
            person_id=uuid4(),
            source_media_asset_id=uuid4(),
            face_image_media_asset_id=None,
            registration_status=self._status,
            validation_notes=self._notes,
            embedding_model=None,
            embedding_version=None,
            is_active=True,
            indexed_at=None,
            created_at=now,
            updated_at=now,
        )


class _FakeRegistrationCompletedUseCase:
    def execute(self, _command):
        now = datetime.now(timezone.utc)
        return PersonFaceRegistration(
            id=uuid4(),
            person_id=uuid4(),
            source_media_asset_id=uuid4(),
            face_image_media_asset_id=None,
            registration_status=RegistrationStatus.INDEXED,
            validation_notes="indexed",
            embedding_model="facenet",
            embedding_version="1",
            is_active=True,
            indexed_at=now,
            created_at=now,
            updated_at=now,
        )


def _build_ingest_container(use_case_builder_name: str, status: IngestStatus):
    bus = _FakeBus()
    container = SimpleNamespace(
        session_factory=_FakeSessionFactory(),
        create_uow=lambda _session: object(),
        realtime_event_bus=bus,
        **{use_case_builder_name: lambda _session, _uow: _FakeIngestUseCase(status)},
    )
    return container, bus


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("builder_name", "handler_name", "event_type"),
    [
        ("build_ingest_recognition_event_use_case", "handle_recognition_event", "recognition_event.detected"),
        ("build_ingest_unknown_event_use_case", "handle_unknown_event", "unknown_event.detected"),
        ("build_ingest_spoof_alert_event_use_case", "handle_spoof_alert", "spoof_alert.detected"),
    ],
)
@pytest.mark.parametrize("status", [IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED])
async def test_business_event_handlers_publish_only_when_processed(
    builder_name: str,
    handler_name: str,
    event_type: str,
    status: IngestStatus,
) -> None:
    container, bus = _build_ingest_container(builder_name, status)
    handler = getattr(BackendEventHandlers(container), handler_name)

    should_ack = await handler(
        {
            "event_name": event_type,
            "message_id": "m-1",
            "correlation_id": "c-1",
            "producer": "ai_service" if event_type != "spoof_alert.detected" else "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"dedupe_key": "d-1"},
        },
        {},
    )

    assert should_ack is True
    assert len(bus.published) == (1 if status == IngestStatus.PROCESSED else 0)


@pytest.mark.asyncio
async def test_frame_analysis_handler_relays_overlay_channel() -> None:
    bus = _FakeBus()
    handler = BackendEventHandlers(
        SimpleNamespace(
            session_factory=_FakeSessionFactory(),
            realtime_event_bus=bus,
        )
    )

    await handler.handle_frame_analysis_updated(
        {
            "event_name": "frame_analysis.updated",
            "message_id": "m-2",
            "correlation_id": "c-2",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"stream_id": "default", "tracks": []},
        },
        {},
    )

    assert len(bus.published) == 1
    assert bus.published[0].event_type == "frame_analysis.updated"
    assert bus.published[0].channel == RealtimeChannel.STREAM_OVERLAY


@pytest.mark.asyncio
async def test_stream_health_handler_relays_health_channel() -> None:
    bus = _FakeBus()
    handler = BackendEventHandlers(
        SimpleNamespace(
            session_factory=_FakeSessionFactory(),
            realtime_event_bus=bus,
        )
    )

    await handler.handle_stream_health_updated(
        {
            "event_name": "stream.health.updated",
            "message_id": "m-3",
            "correlation_id": "c-3",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"status": "ok"},
        },
        {},
    )

    assert len(bus.published) == 1
    assert bus.published[0].event_type == "stream.health.updated"
    assert bus.published[0].channel == RealtimeChannel.STREAM_HEALTH


@pytest.mark.asyncio
async def test_registration_input_validated_handler_publishes_business_realtime_event() -> None:
    bus = _FakeBus()
    container = SimpleNamespace(
        session_factory=_FakeSessionFactory(),
        realtime_event_bus=bus,
        build_apply_registration_input_validation_use_case=lambda _session: _FakeRegistrationValidationUseCase(),
    )
    handler = BackendEventHandlers(container)

    await handler.handle_registration_input_validated(
        {
            "event_name": "registration_input.validated",
            "message_id": "m-4",
            "correlation_id": "c-4",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
        },
        {
            "registration_id": str(uuid4()),
            "status": "accepted",
            "validated_at": "2026-05-06T00:00:00Z",
        },
    )

    assert len(bus.published) == 1
    assert bus.published[0].event_type == "registration_input.validated"
    assert bus.published[0].channel == RealtimeChannel.EVENTS_BUSINESS


@pytest.mark.asyncio
async def test_registration_processing_completed_handler_publishes_business_realtime_event() -> None:
    bus = _FakeBus()
    container = SimpleNamespace(
        session_factory=_FakeSessionFactory(),
        realtime_event_bus=bus,
        build_complete_face_registration_use_case=lambda _session: _FakeRegistrationCompletedUseCase(),
    )
    handler = BackendEventHandlers(container)

    await handler.handle_registration_processing_completed(
        {
            "event_name": "registration_processing.completed",
            "message_id": "m-5",
            "correlation_id": "c-5",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
        },
        {
            "registration_id": str(uuid4()),
            "status": "indexed",
        },
    )

    assert len(bus.published) == 1
    assert bus.published[0].event_type == "registration_processing.completed"
    assert bus.published[0].channel == RealtimeChannel.EVENTS_BUSINESS


@pytest.mark.asyncio
async def test_registration_input_validated_handler_rejects_missing_required_fields() -> None:
    handler = BackendEventHandlers(
        SimpleNamespace(
            session_factory=_FakeSessionFactory(),
            realtime_event_bus=_FakeBus(),
            build_apply_registration_input_validation_use_case=lambda _session: _FakeRegistrationValidationUseCase(),
        )
    )

    with pytest.raises(ValidationError):
        await handler.handle_registration_input_validated(
            {
                "event_name": "registration_input.validated",
                "message_id": "m-6",
                "correlation_id": "c-6",
                "producer": "pipeline",
                "occurred_at": "2026-05-06T00:00:00Z",
            },
            {"status": "accepted", "validated_at": "2026-05-06T00:00:00Z"},
        )


@pytest.mark.asyncio
async def test_registration_processing_completed_handler_rejects_missing_required_fields() -> None:
    handler = BackendEventHandlers(
        SimpleNamespace(
            session_factory=_FakeSessionFactory(),
            realtime_event_bus=_FakeBus(),
            build_complete_face_registration_use_case=lambda _session: _FakeRegistrationCompletedUseCase(),
        )
    )

    with pytest.raises(ValidationError):
        await handler.handle_registration_processing_completed(
            {
                "event_name": "registration_processing.completed",
                "message_id": "m-7",
                "correlation_id": "c-7",
                "producer": "ai_service",
                "occurred_at": "2026-05-06T00:00:00Z",
            },
            {"registration_id": str(uuid4())},
        )
