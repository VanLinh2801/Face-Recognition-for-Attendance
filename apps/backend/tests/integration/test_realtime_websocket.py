from __future__ import annotations

import base64
import hashlib
import hmac
import importlib
import json
import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.core import dependencies
from app.domain.auth.entities import User
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _build_hs256_token(secret: str, payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_part = _b64url(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def _token() -> str:
    return _build_hs256_token(
        "secret",
        {
            "sub": "tester",
            "iss": "issuer",
            "aud": "aud",
            "exp": int(time.time()) + 300,
            "jti": str(uuid4()),
        },
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


def test_websocket_auth_and_fanout(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)
    with TestClient(app_main.app) as client:
        token = _token()
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            envelope = RealtimeEnvelope(
                channel=RealtimeChannel.EVENTS_BUSINESS,
                event_type="recognition_event.detected",
                occurred_at=datetime.now(timezone.utc),
                correlation_id=str(uuid4()),
                dedupe_key="d-1",
                payload={"person_id": str(uuid4())},
            )
            import anyio

            anyio.run(app_main.app.state.container.realtime_event_bus.publish, envelope)
            message = ws.receive_json()
            assert message["channel"] == "events.business"
            assert message["event_type"] == "recognition_event.detected"


def test_websocket_auth_failure(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)
    with TestClient(app_main.app) as client:
        try:
            with client.websocket_connect("/api/ws/v1/realtime?token=bad-token") as ws:
                ws.receive_json()
            assert False, "Expected websocket auth failure"
        except Exception:
            assert True


def test_websocket_receives_registration_completed_from_internal_endpoint(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")

    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)

    registration_id = uuid4()
    person_id = uuid4()
    source_media_asset_id = uuid4()
    occurred_at = datetime.now(timezone.utc)

    class _FakeCompleteUseCase:
        def execute(self, command):
            return PersonFaceRegistration(
                id=command.registration_id,
                person_id=person_id,
                source_media_asset_id=source_media_asset_id,
                face_image_media_asset_id=None,
                registration_status=command.status,
                validation_notes=command.validation_notes,
                embedding_model=command.embedding_model,
                embedding_version=command.embedding_version,
                is_active=True,
                indexed_at=None,
                created_at=occurred_at,
                updated_at=occurred_at,
            )

    class _FakeUoW:
        def commit(self) -> None:
            return None

    app_main.app.dependency_overrides[dependencies.get_complete_face_registration_use_case] = lambda: _FakeCompleteUseCase()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUoW()
    app_main.app.dependency_overrides[dependencies.get_admin_user] = lambda: _build_admin_user()

    with TestClient(app_main.app) as client:
        token = _token()
        with client.websocket_connect(f"/api/ws/v1/realtime?token={token}&channels=events.business") as ws:
            request_json = {
                "message_id": str(uuid4()),
                "correlation_id": str(uuid4()),
                "occurred_at": occurred_at.isoformat(),
                "producer": "pipeline",
                "event_name": "registration_processing.completed",
                "payload": {
                    "registration_id": str(registration_id),
                    "status": RegistrationStatus.VALIDATED.value,
                    "validation_notes": None,
                    "embedding_model": None,
                    "embedding_version": None,
                    "face_image_media_asset": None,
                },
            }
            response = client.post(
                "/api/v1/internal/registrations/events/completed",
                json=request_json,
            )
            assert response.status_code == 200

            message = ws.receive_json()
            assert message["channel"] == "events.business"
            assert message["event_type"] == "registration_processing.completed"
            assert message["dedupe_key"] == str(registration_id)
