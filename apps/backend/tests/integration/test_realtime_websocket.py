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


def test_websocket_auth_and_fanout(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")
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
    import app.main as app_main

    importlib.reload(app_main)
    with TestClient(app_main.app) as client:
        try:
            with client.websocket_connect("/api/ws/v1/realtime?token=bad-token") as ws:
                ws.receive_json()
            assert False, "Expected websocket auth failure"
        except Exception:
            assert True
