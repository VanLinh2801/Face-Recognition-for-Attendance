from __future__ import annotations

import importlib
import json
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

import anyio
from fastapi.testclient import TestClient

from app.application.use_cases.event_ingestion import IngestResult, IngestStatus
from app.core import dependencies
from app.domain.auth.entities import User
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus
from app.infrastructure.integrations.contract_validator import ContractValidator
from app.infrastructure.integrations.event_handlers import BackendEventHandlers, register_backend_event_handlers
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer


class _FakeUow:
    def commit(self):
        return None


class _RecordingPublisher:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def publish_registration_requested(self, **kwargs):
        self.calls.append(kwargs)
        return {"stream_id": "1-0", "message_id": str(uuid4()), "correlation_id": str(uuid4())}

    async def close(self):
        return None


class _FakeRedisClient:
    def __init__(self) -> None:
        self.acked: list[tuple[str, str, str]] = []

    async def xack(self, stream: str, group: str, message_id: str) -> None:
        self.acked.append((stream, group, message_id))


class _StaticIngestUseCase:
    def __init__(self, status: IngestStatus) -> None:
        self._status = status

    def execute(self, _envelope):
        return IngestResult(status=self._status)


class _FakeCreateRegistrationUseCase:
    def __init__(self, registration: PersonFaceRegistration) -> None:
        self._registration = registration

    def execute(self, _command):
        return self._registration, {
            "media_asset_id": str(self._registration.source_media_asset_id),
            "storage_provider": "minio",
            "bucket_name": "attendance",
            "object_key": "uploads/source.jpg",
            "original_filename": "source.jpg",
            "mime_type": "image/jpeg",
            "file_size": 10,
            "checksum": None,
            "asset_type": "registration_face",
        }


class _FakeApplyRegistrationInputValidationUseCase:
    def __init__(self, person_id: UUID, source_media_asset_id: UUID) -> None:
        self._person_id = person_id
        self._source_media_asset_id = source_media_asset_id

    def execute(self, command):
        now = datetime.now(timezone.utc)
        registration_status = RegistrationStatus.FAILED if command.status == "rejected" else RegistrationStatus.PENDING
        return PersonFaceRegistration(
            id=command.registration_id,
            person_id=self._person_id,
            source_media_asset_id=self._source_media_asset_id,
            face_image_media_asset_id=None,
            registration_status=registration_status,
            validation_notes=command.validation_notes,
            embedding_model=None,
            embedding_version=None,
            is_active=True,
            indexed_at=None,
            created_at=now,
            updated_at=now,
        )


class _FakeCompleteRegistrationUseCase:
    def __init__(self, person_id: UUID, source_media_asset_id: UUID) -> None:
        self._person_id = person_id
        self._source_media_asset_id = source_media_asset_id

    def execute(self, command):
        now = datetime.now(timezone.utc)
        return PersonFaceRegistration(
            id=command.registration_id,
            person_id=self._person_id,
            source_media_asset_id=self._source_media_asset_id,
            face_image_media_asset_id=None,
            registration_status=command.status,
            validation_notes=command.validation_notes,
            embedding_model=command.embedding_model,
            embedding_version=command.embedding_version,
            is_active=True,
            indexed_at=now if command.status == RegistrationStatus.INDEXED else None,
            created_at=now,
            updated_at=now,
        )


def _build_admin_user() -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username="admin",
        password_hash="x",
        is_active=True,
        last_login_at=now,
        created_at=now,
        updated_at=now,
    )


def _b64url(raw: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _token() -> str:
    import hashlib
    import hmac

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "tester",
        "iss": "issuer",
        "aud": "aud",
        "exp": int(time.time()) + 300,
        "jti": str(uuid4()),
    }
    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new("secret".encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_part}.{payload_part}.{_b64url(signature)}"


def _build_app(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")

    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)
    app_main.app.dependency_overrides[dependencies.get_admin_user] = lambda: _build_admin_user()
    return app_main


def _build_consumer(container) -> tuple[RedisEventConsumer, _FakeRedisClient]:
    consumer = RedisEventConsumer(container.settings)
    fake_client = _FakeRedisClient()
    consumer._client = fake_client  # type: ignore[assignment]
    consumer.set_validator(ContractValidator())
    register_backend_event_handlers(consumer, BackendEventHandlers(container))
    return consumer, fake_client


def _consumer_record(envelope: dict, stream_name: str, message_id: str) -> list[tuple[str, list[tuple[str, dict[str, str]]]]]:
    return [(stream_name, [(message_id, {"envelope": json.dumps(envelope)})])]


def _base_envelope(event_name: str, producer: str, payload: dict) -> dict:
    return {
        "event_name": event_name,
        "event_version": "1.0.0",
        "message_id": str(uuid4()),
        "correlation_id": str(uuid4()),
        "causation_id": None,
        "producer": producer,
        "occurred_at": "2026-05-06T00:00:00Z",
        "payload": payload,
    }


def _registration_validation_envelope(person_id: UUID, registration_id: UUID, status: str) -> dict:
    return _base_envelope(
        "registration_input.validated",
        "pipeline",
        {
            "person_id": str(person_id),
            "registration_id": str(registration_id),
            "status": status,
            "validated_at": "2026-05-06T00:00:00Z",
            "event_source": "pipeline",
            "validation_notes": "pipeline-check",
        },
    )


def _registration_completed_envelope(person_id: UUID, registration_id: UUID) -> dict:
    return _base_envelope(
        "registration_processing.completed",
        "ai_service",
        {
            "person_id": str(person_id),
            "registration_id": str(registration_id),
            "status": "indexed",
            "event_source": "ai_service",
            "embedding_model": "facenet",
            "embedding_version": "1",
        },
    )


def _recognition_envelope() -> dict:
    return _base_envelope(
        "recognition_event.detected",
        "ai_service",
        {
            "stream_id": "default",
            "frame_id": "frame-1",
            "frame_sequence": 1,
            "track_id": "track-1",
            "person_id": str(uuid4()),
            "face_registration_id": str(uuid4()),
            "recognized_at": "2026-05-06T00:00:00Z",
            "event_direction": "entry",
            "event_source": "ai_service",
            "dedupe_key": "rk-1",
        },
    )


def _spoof_envelope() -> dict:
    return _base_envelope(
        "spoof_alert.detected",
        "pipeline",
        {
            "stream_id": "default",
            "frame_id": "frame-2",
            "frame_sequence": 2,
            "track_id": "track-2",
            "detected_at": "2026-05-06T00:00:00Z",
            "spoof_score": 0.98,
            "severity": "high",
            "review_status": "new",
            "event_source": "pipeline",
            "dedupe_key": "sk-1",
        },
    )


def _overlay_envelope() -> dict:
    return _base_envelope(
        "frame_analysis.updated",
        "pipeline",
        {
            "stream_id": "default",
            "frame_id": "frame-3",
            "frame_sequence": 3,
            "captured_at": "2026-05-06T00:00:00Z",
            "presentation_ts_ms": 120,
            "frame_width": 1280,
            "frame_height": 720,
            "tracks": [
                {
                    "track_id": "track-3",
                    "bbox": {"x": 12, "y": 18, "width": 30, "height": 40},
                    "tracking_state": "tracking",
                    "analysis_status": "detected",
                    "display_label": "Face #1",
                }
            ],
        },
    )


def test_registration_success_flow_from_api_to_pipeline_and_ai_events(monkeypatch):
    app_main = _build_app(monkeypatch)
    person_id = uuid4()
    registration = PersonFaceRegistration(
        id=uuid4(),
        person_id=person_id,
        source_media_asset_id=uuid4(),
        face_image_media_asset_id=None,
        registration_status=RegistrationStatus.PENDING,
        validation_notes=None,
        embedding_model=None,
        embedding_version=None,
        is_active=True,
        indexed_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    publisher = _RecordingPublisher()

    app_main.app.dependency_overrides[dependencies.get_create_face_registration_use_case] = lambda: _FakeCreateRegistrationUseCase(registration)
    app_main.app.dependency_overrides[dependencies.get_pipeline_event_publisher] = lambda: publisher
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUow()
    with TestClient(app_main.app) as client:
        container = app_main.app.state.container
        monkeypatch.setattr(
            type(container),
            "build_apply_registration_input_validation_use_case",
            lambda self, _session: _FakeApplyRegistrationInputValidationUseCase(
                registration.person_id, registration.source_media_asset_id
            ),
        )
        monkeypatch.setattr(
            type(container),
            "build_complete_face_registration_use_case",
            lambda self, _session: _FakeCompleteRegistrationUseCase(registration.person_id, registration.source_media_asset_id),
        )
        consumer, fake_client = _build_consumer(container)
        token = _token()
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            response = client.post(
                f"/api/v1/persons/{person_id}/registrations",
                json={
                    "requested_by_person_id": str(person_id),
                    "source_media_asset": {
                        "storage_provider": "minio",
                        "bucket_name": "attendance",
                        "object_key": "uploads/1.jpg",
                        "original_filename": "1.jpg",
                        "mime_type": "image/jpeg",
                        "file_size": 10,
                        "asset_type": "registration_face",
                    },
                },
            )
            assert response.status_code == 201
            assert len(publisher.calls) == 1
            assert publisher.calls[0]["registration_id"] == registration.id

            anyio.run(
                consumer._handle_records,
                _consumer_record(
                    _registration_validation_envelope(registration.person_id, registration.id, "accepted"),
                    "pipeline.backend.events",
                    "101-0",
                ),
            )
            validated_message = ws.receive_json()
            assert validated_message["event_type"] == "registration_input.validated"
            assert validated_message["payload"]["status"] == "accepted"
            assert validated_message["payload"]["registration_status"] == "pending"

            anyio.run(
                consumer._handle_records,
                _consumer_record(
                    _registration_completed_envelope(registration.person_id, registration.id),
                    "ai.backend.events",
                    "102-0",
                ),
            )
            completed_message = ws.receive_json()
            assert completed_message["event_type"] == "registration_processing.completed"
            assert completed_message["payload"]["registration_status"] == "indexed"

    assert fake_client.acked == [
        ("pipeline.backend.events", "backend-consumers", "101-0"),
        ("ai.backend.events", "backend-consumers", "102-0"),
    ]


def test_registration_rejected_flow_emits_failed_state(monkeypatch):
    app_main = _build_app(monkeypatch)
    person_id = uuid4()
    registration = PersonFaceRegistration(
        id=uuid4(),
        person_id=person_id,
        source_media_asset_id=uuid4(),
        face_image_media_asset_id=None,
        registration_status=RegistrationStatus.PENDING,
        validation_notes=None,
        embedding_model=None,
        embedding_version=None,
        is_active=True,
        indexed_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    publisher = _RecordingPublisher()

    app_main.app.dependency_overrides[dependencies.get_create_face_registration_use_case] = lambda: _FakeCreateRegistrationUseCase(registration)
    app_main.app.dependency_overrides[dependencies.get_pipeline_event_publisher] = lambda: publisher
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUow()
    with TestClient(app_main.app) as client:
        monkeypatch.setattr(
            type(app_main.app.state.container),
            "build_apply_registration_input_validation_use_case",
            lambda self, _session: _FakeApplyRegistrationInputValidationUseCase(
                registration.person_id, registration.source_media_asset_id
            ),
        )
        consumer, fake_client = _build_consumer(app_main.app.state.container)
        token = _token()
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            response = client.post(
                f"/api/v1/persons/{person_id}/registrations",
                json={
                    "requested_by_person_id": str(person_id),
                    "source_media_asset": {
                        "storage_provider": "minio",
                        "bucket_name": "attendance",
                        "object_key": "uploads/2.jpg",
                        "original_filename": "2.jpg",
                        "mime_type": "image/jpeg",
                        "file_size": 10,
                        "asset_type": "registration_face",
                    },
                },
            )
            assert response.status_code == 201

            anyio.run(
                consumer._handle_records,
                _consumer_record(
                    _registration_validation_envelope(registration.person_id, registration.id, "rejected"),
                    "pipeline.backend.events",
                    "201-0",
                ),
            )
            message = ws.receive_json()
            assert message["event_type"] == "registration_input.validated"
            assert message["payload"]["status"] == "rejected"
            assert message["payload"]["registration_status"] == "failed"

    assert fake_client.acked == [("pipeline.backend.events", "backend-consumers", "201-0")]


def test_recognition_flow_processed_then_duplicate(monkeypatch):
    app_main = _build_app(monkeypatch)
    token = _token()

    with TestClient(app_main.app) as client:
        container = app_main.app.state.container
        consumer, fake_client = _build_consumer(container)
        metrics = container.websocket_hub.metrics
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            monkeypatch.setattr(
                type(container),
                "build_ingest_recognition_event_use_case",
                lambda self, _session, _uow: _StaticIngestUseCase(IngestStatus.PROCESSED),
            )
            anyio.run(consumer._handle_records, _consumer_record(_recognition_envelope(), "ai.backend.events", "301-0"))
            processed_message = ws.receive_json()
            assert processed_message["event_type"] == "recognition_event.detected"

            sent_before = metrics.sent_messages
            monkeypatch.setattr(
                type(container),
                "build_ingest_recognition_event_use_case",
                lambda self, _session, _uow: _StaticIngestUseCase(IngestStatus.DUPLICATE),
            )
            anyio.run(consumer._handle_records, _consumer_record(_recognition_envelope(), "ai.backend.events", "302-0"))
            assert metrics.sent_messages == sent_before

    assert fake_client.acked == [
        ("ai.backend.events", "backend-consumers", "301-0"),
        ("ai.backend.events", "backend-consumers", "302-0"),
    ]


def test_spoof_flow_processed_emits_business_event(monkeypatch):
    app_main = _build_app(monkeypatch)
    token = _token()

    with TestClient(app_main.app) as client:
        monkeypatch.setattr(
            type(app_main.app.state.container),
            "build_ingest_spoof_alert_event_use_case",
            lambda self, _session, _uow: _StaticIngestUseCase(IngestStatus.PROCESSED),
        )
        consumer, fake_client = _build_consumer(app_main.app.state.container)
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            anyio.run(consumer._handle_records, _consumer_record(_spoof_envelope(), "pipeline.backend.events", "401-0"))
            message = ws.receive_json()
            assert message["event_type"] == "spoof_alert.detected"
            assert message["channel"] == "events.business"

    assert fake_client.acked == [("pipeline.backend.events", "backend-consumers", "401-0")]


def test_overlay_relay_flow_preserves_payload_shape(monkeypatch):
    app_main = _build_app(monkeypatch)
    token = _token()
    overlay_envelope = _overlay_envelope()

    with TestClient(app_main.app) as client:
        consumer, fake_client = _build_consumer(app_main.app.state.container)
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=stream.overlay") as ws:
            anyio.run(consumer._handle_records, _consumer_record(overlay_envelope, "pipeline.backend.events", "501-0"))
            message = ws.receive_json()
            assert message["event_type"] == "frame_analysis.updated"
            assert message["channel"] == "stream.overlay"
            assert message["payload"] == overlay_envelope["payload"]

    assert fake_client.acked == [("pipeline.backend.events", "backend-consumers", "501-0")]


def test_stream_health_passthrough_relay(monkeypatch):
    app_main = _build_app(monkeypatch)
    token = _token()
    envelope = _base_envelope("stream.health.updated", "pipeline", {"status": "ok", "stream_id": "default"})

    with TestClient(app_main.app) as client:
        consumer, fake_client = _build_consumer(app_main.app.state.container)
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=stream.health") as ws:
            anyio.run(consumer._handle_records, _consumer_record(envelope, "pipeline.backend.events", "601-0"))
            message = ws.receive_json()
            assert message["event_type"] == "stream.health.updated"
            assert message["channel"] == "stream.health"
            assert message["payload"] == envelope["payload"]

    assert fake_client.acked == [("pipeline.backend.events", "backend-consumers", "601-0")]
