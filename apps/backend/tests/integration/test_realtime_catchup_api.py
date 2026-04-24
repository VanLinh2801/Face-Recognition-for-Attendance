from __future__ import annotations

import importlib
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core import dependencies
from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope


class _FakeCatchupUseCase:
    def execute(self, query):
        if query.channel != RealtimeChannel.EVENTS_BUSINESS:
            return []
        return [
            RealtimeEnvelope(
                channel=RealtimeChannel.EVENTS_BUSINESS,
                event_type="spoof_alert.detected",
                occurred_at=datetime(2026, 4, 24, 1, 0, 0, tzinfo=timezone.utc),
                correlation_id=None,
                dedupe_key="sk-1",
                payload={"id": "spoof-1"},
                metadata={"source": "catchup"},
            ),
            RealtimeEnvelope(
                channel=RealtimeChannel.EVENTS_BUSINESS,
                event_type="recognition_event.detected",
                occurred_at=datetime(2026, 4, 24, 1, 0, 1, tzinfo=timezone.utc),
                correlation_id=None,
                dedupe_key="rk-1",
                payload={"id": "rec-1"},
                metadata={"source": "catchup"},
            ),
        ]


def test_realtime_catchup_endpoint(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    import app.main as app_main

    importlib.reload(app_main)
    app_main.app.dependency_overrides[dependencies.get_realtime_catchup_use_case] = lambda: _FakeCatchupUseCase()

    with TestClient(app_main.app) as client:
        response = client.get(
            "/api/ws/v1/realtime/catchup",
            params={"channel": "events.business", "since_timestamp": "2026-04-24T00:59:00Z", "limit": 10},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["channel"] == "events.business"
        assert len(payload["items"]) == 2
        assert payload["items"][0]["event_type"] == "spoof_alert.detected"
