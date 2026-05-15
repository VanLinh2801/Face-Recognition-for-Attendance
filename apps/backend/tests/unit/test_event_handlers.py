from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.dtos.realtime import RealtimeChannel
from app.application.use_cases.event_ingestion import IngestResult, IngestStatus
from app.core.exceptions import ValidationError
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import EventDirection, RegistrationStatus, SpoofReviewStatus, SpoofSeverity, UnknownEventReviewStatus
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent
from app.infrastructure.integrations.event_handlers import BackendEventHandlers


# ─── Fake classes ────────────────────────────────────────────────────────────

class _FakeSession:
    def __init__(self, person_exists: bool = True) -> None:
        self.person_exists = person_exists

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None

    def commit(self):
        return None

    def get(self, _model, _id):
        return None


class _FakeSessionFactory:
    def __init__(self, person_exists: bool = True) -> None:
        self._person_exists = person_exists

    def __call__(self):
        return _FakeSession(person_exists=self._person_exists)


class _FakeBus:
    def __init__(self) -> None:
        self.published: list = []

    async def publish(self, envelope):
        self.published.append(envelope)


class _FakeDashboardHealthState:
    def __init__(self) -> None:
        self.recorded: list[dict] = []

    def record_stream_health(self, *, payload, occurred_at) -> None:
        self.recorded.append({"payload": payload, "occurred_at": occurred_at})


class _FakePersonRepository:
    def __init__(self, exists_result: bool = True, get_result=None) -> None:
        self._exists_result = exists_result
        self._get_result = get_result

    def exists(self, _person_id) -> bool:
        return self._exists_result

    def get_person(self, _person_id):
        return self._get_result


class _FakeIngestUseCase:
    def __init__(self, status: IngestStatus, item=None) -> None:
        self._status = status
        self._item = item
        self.last_envelope = None

    def execute(self, _envelope):
        self.last_envelope = _envelope
        return IngestResult(status=self._status, item=self._item)


class _FakeRegistrationValidationUseCase:
    def __init__(self, status: RegistrationStatus = RegistrationStatus.VALIDATED, notes: str | None = "accepted") -> None:
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


# ─── Test fixtures ─────────────────────────────────────────────────────────────

def _make_container(
    *,
    person_exists: bool = True,
    recognition_status: IngestStatus = IngestStatus.PROCESSED,
    unknown_status: IngestStatus = IngestStatus.PROCESSED,
):
    bus = _FakeBus()
    person_repo = _FakePersonRepository(
        exists_result=person_exists,
        get_result=None,
    )
    recognition_use_case = _FakeIngestUseCase(recognition_status)
    unknown_use_case = _FakeIngestUseCase(unknown_status)

    def create_person_repository(_session):
        return person_repo

    health_state = _FakeDashboardHealthState()
    return SimpleNamespace(
        session_factory=_FakeSessionFactory(person_exists=person_exists),
        create_uow=lambda _session: object(),
        realtime_event_bus=bus,
        dashboard_health_state=health_state,
        create_person_repository=create_person_repository,
        build_ingest_recognition_event_use_case=lambda _session, _uow: recognition_use_case,
        build_ingest_unknown_event_use_case=lambda _session, _uow: unknown_use_case,
        build_ingest_spoof_alert_event_use_case=lambda _session, _uow: _FakeIngestUseCase(IngestStatus.PROCESSED),
    ), bus, person_repo, recognition_use_case, unknown_use_case, health_state


def _make_minimal_container():
    bus = _FakeBus()
    person_repo = _FakePersonRepository()
    health_state = _FakeDashboardHealthState()
    return SimpleNamespace(
        session_factory=_FakeSessionFactory(),
        create_uow=lambda _session: object(),
        realtime_event_bus=bus,
        dashboard_health_state=health_state,
        create_person_repository=lambda _session: person_repo,
    ), bus, health_state


# ─── Tests: recognition_event handler with person validation ─────────────────

@pytest.mark.asyncio
async def test_recognition_event_persisted_when_person_exists():
    container, bus, _, _, _, _ = _make_container(person_exists=True, recognition_status=IngestStatus.PROCESSED)
    handler = BackendEventHandlers(container)

    result = await handler.handle_recognition_event(
        {
            "event_name": "recognition_event.detected",
            "message_id": "m-1",
            "correlation_id": "c-1",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {
                "person_id": str(uuid4()),
                "dedupe_key": "d-1",
                "recognized_at": "2026-05-06T00:00:00Z",
                "face_registration_id": str(uuid4()),
                "event_direction": "entry",
                "event_source": "ai_service",
            },
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 1
    assert bus.published[0].event_type == "recognition_event.detected"


@pytest.mark.asyncio
async def test_recognition_event_converted_to_unknown_when_person_not_found():
    container, bus, _, _, unknown_use_case, _ = _make_container(
        person_exists=False,
        unknown_status=IngestStatus.PROCESSED,
    )
    handler = BackendEventHandlers(container)

    result = await handler.handle_recognition_event(
        {
            "event_name": "recognition_event.detected",
            "message_id": "m-2",
            "correlation_id": "c-2",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {
                "person_id": str(uuid4()),
                "dedupe_key": "d-2",
                "recognized_at": "2026-05-06T00:00:00Z",
                "stream_id": "default",
                "frame_id": "frame-1",
                "frame_sequence": 1,
                "track_id": "track-1",
                "event_direction": "unknown",
                "event_source": "ai_service",
                "face_registration_id": str(uuid4()),
            },
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 1
    assert bus.published[0].event_type == "unknown_event.detected"
    assert unknown_use_case.last_envelope["event_name"] == "unknown_event.detected"
    assert unknown_use_case.last_envelope["payload"]["detected_at"] == "2026-05-06T00:00:00Z"
    assert unknown_use_case.last_envelope["payload"]["review_status"] == "new"


@pytest.mark.asyncio
async def test_recognition_event_converted_to_unknown_when_person_id_invalid():
    container, bus, _, _, unknown_use_case, _ = _make_container(
        person_exists=False,
        unknown_status=IngestStatus.PROCESSED,
    )
    handler = BackendEventHandlers(container)

    result = await handler.handle_recognition_event(
        {
            "event_name": "recognition_event.detected",
            "message_id": "m-3",
            "correlation_id": "c-3",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {
                "person_id": "not-a-uuid",
                "dedupe_key": "d-3",
                "recognized_at": "2026-05-06T00:00:00Z",
                "stream_id": "default",
                "frame_id": "frame-2",
                "frame_sequence": 2,
                "track_id": "track-2",
                "event_direction": "unknown",
                "event_source": "ai_service",
                "face_registration_id": str(uuid4()),
            },
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 1
    assert bus.published[0].event_type == "unknown_event.detected"
    assert unknown_use_case.last_envelope["event_name"] == "unknown_event.detected"
    assert unknown_use_case.last_envelope["payload"]["track_id"] == "track-2"


@pytest.mark.asyncio
async def test_recognition_event_no_publish_when_duplicated():
    container, bus, _, _, _, _ = _make_container(person_exists=True, recognition_status=IngestStatus.DUPLICATE)
    handler = BackendEventHandlers(container)

    result = await handler.handle_recognition_event(
        {
            "event_name": "recognition_event.detected",
            "message_id": "m-4",
            "correlation_id": "c-4",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {
                "person_id": str(uuid4()),
                "dedupe_key": "d-4",
                "recognized_at": "2026-05-06T00:00:00Z",
                "face_registration_id": str(uuid4()),
                "event_direction": "entry",
                "event_source": "ai_service",
            },
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 0


# ─── Tests: other event handlers ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unknown_event_handler_publishes_when_processed():
    container, bus, _ = _make_minimal_container()
    event_id = uuid4()
    snapshot_media_asset_id = uuid4()
    container.build_ingest_unknown_event_use_case = lambda _s, _u: _FakeIngestUseCase(
        IngestStatus.PROCESSED,
        UnknownEvent(
            id=event_id,
            snapshot_media_asset_id=snapshot_media_asset_id,
            detected_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
            event_direction=EventDirection.UNKNOWN,
            match_score=0.42,
            spoof_score=0.07,
            event_source="ai_service",
            dedupe_key="d-u1",
            raw_payload={"track_id": "track-u1"},
            review_status=UnknownEventReviewStatus.NEW,
            notes=None,
            created_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
            updated_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
        ),
    )
    handler = BackendEventHandlers(container)

    result = await handler.handle_unknown_event(
        {
            "event_name": "unknown_event.detected",
            "message_id": "m-u1",
            "correlation_id": "c-u1",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"dedupe_key": "d-u1", "detected_at": "2026-05-06T00:00:00Z", "event_direction": "unknown", "event_source": "ai_service", "review_status": "new"},
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 1
    assert bus.published[0].event_type == "unknown_event.detected"
    assert bus.published[0].payload == {
        "id": str(event_id),
        "detected_at": "2026-05-06T00:00:00+00:00",
        "event_direction": "unknown",
        "match_score": 0.42,
        "spoof_score": 0.07,
        "event_source": "ai_service",
        "review_status": "new",
        "notes": None,
        "snapshot_media_asset_id": str(snapshot_media_asset_id),
        "track_id": "track-u1",
        "dedupe_key": "d-u1",
    }


@pytest.mark.asyncio
async def test_unknown_event_handler_no_publish_when_duplicated():
    container, bus, _ = _make_minimal_container()
    container.build_ingest_unknown_event_use_case = lambda _s, _u: _FakeIngestUseCase(IngestStatus.DUPLICATE)
    handler = BackendEventHandlers(container)

    result = await handler.handle_unknown_event(
        {
            "event_name": "unknown_event.detected",
            "message_id": "m-u2",
            "correlation_id": "c-u2",
            "producer": "ai_service",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"dedupe_key": "d-u2", "detected_at": "2026-05-06T00:00:00Z", "event_direction": "unknown", "event_source": "ai_service", "review_status": "new"},
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 0


@pytest.mark.asyncio
async def test_spoof_alert_handler_publishes_when_processed():
    container, bus, _ = _make_minimal_container()
    person_id = uuid4()
    event_id = uuid4()
    snapshot_media_asset_id = uuid4()
    container.create_person_repository = lambda _s: _FakePersonRepository(
        get_result=SimpleNamespace(full_name="WebSocket Test Person"),
    )
    container.build_ingest_spoof_alert_event_use_case = lambda _s, _u: _FakeIngestUseCase(
        IngestStatus.PROCESSED,
        SpoofAlertEvent(
            id=event_id,
            person_id=person_id,
            snapshot_media_asset_id=snapshot_media_asset_id,
            detected_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
            spoof_score=0.98,
            event_source="pipeline",
            dedupe_key="d-s1",
            raw_payload={"track_id": "track-s1"},
            severity=SpoofSeverity.HIGH,
            review_status=SpoofReviewStatus.NEW,
            notes=None,
            created_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
            updated_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
        ),
    )
    handler = BackendEventHandlers(container)

    result = await handler.handle_spoof_alert(
        {
            "event_name": "spoof_alert.detected",
            "message_id": "m-s1",
            "correlation_id": "c-s1",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"dedupe_key": "d-s1", "detected_at": "2026-05-06T00:00:00Z", "event_source": "pipeline", "severity": "high", "review_status": "new"},
        },
        {},
    )

    assert result is True
    assert len(bus.published) == 1
    assert bus.published[0].event_type == "spoof_alert.detected"
    assert bus.published[0].payload == {
        "id": str(event_id),
        "person_id": str(person_id),
        "person_name": "WebSocket Test Person",
        "detected_at": "2026-05-06T00:00:00+00:00",
        "spoof_score": 0.98,
        "severity": "high",
        "event_source": "pipeline",
        "review_status": "new",
        "notes": None,
        "snapshot_media_asset_id": str(snapshot_media_asset_id),
        "track_id": "track-s1",
        "dedupe_key": "d-s1",
    }


@pytest.mark.asyncio
async def test_frame_analysis_handler_relays_overlay_channel():
    container, bus, _ = _make_minimal_container()
    handler = BackendEventHandlers(container)

    await handler.handle_frame_analysis_updated(
        {
            "event_name": "frame_analysis.updated",
            "message_id": "m-1",
            "correlation_id": "c-1",
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
async def test_stream_health_handler_relays_health_channel():
    container, bus, health_state = _make_minimal_container()
    handler = BackendEventHandlers(container)

    await handler.handle_stream_health_updated(
        {
            "event_name": "stream.health.updated",
            "message_id": "m-2",
            "correlation_id": "c-2",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"status": "ok"},
        },
        {},
    )

    assert len(bus.published) == 1
    assert bus.published[0].event_type == "stream.health.updated"
    assert bus.published[0].channel == RealtimeChannel.STREAM_HEALTH
    assert health_state.recorded[0]["payload"] == {"status": "ok"}


@pytest.mark.asyncio
async def test_registration_input_validated_handler_publishes_business_realtime_event():
    container, bus, _ = _make_minimal_container()
    container.build_apply_registration_input_validation_use_case = lambda _s: _FakeRegistrationValidationUseCase()
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
    assert bus.published[0].payload["registration_status"] == "validated"


@pytest.mark.asyncio
async def test_registration_processing_completed_handler_publishes_business_realtime_event():
    container, bus, _ = _make_minimal_container()
    container.build_complete_face_registration_use_case = lambda _s: _FakeRegistrationCompletedUseCase()
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
async def test_registration_input_validated_handler_rejects_missing_required_fields():
    container, bus, _ = _make_minimal_container()
    container.build_apply_registration_input_validation_use_case = lambda _s: _FakeRegistrationValidationUseCase()
    handler = BackendEventHandlers(container)

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
async def test_registration_processing_completed_handler_rejects_missing_required_fields():
    container, bus, _ = _make_minimal_container()
    container.build_complete_face_registration_use_case = lambda _s: _FakeRegistrationCompletedUseCase()
    handler = BackendEventHandlers(container)

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
