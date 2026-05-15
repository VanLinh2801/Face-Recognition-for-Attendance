from datetime import datetime, timezone

from app.infrastructure.integrations.dashboard_health_state import DashboardHealthState
from app.infrastructure.realtime.websocket_hub import RealtimeMetrics


def test_dashboard_health_state_returns_unknown_without_stream_telemetry():
    state = DashboardHealthState()

    snapshot = state.snapshot(
        realtime_metrics=RealtimeMetrics(active_connections=1),
        backend_ready=True,
    )

    assert snapshot.backend.status == "healthy"
    assert snapshot.realtime_ws.status == "healthy"
    assert snapshot.realtime_ws.label == "active"
    assert snapshot.stream.status == "unknown"
    assert snapshot.camera_source.status == "unknown"
    assert snapshot.stream.details["fps"] is None


def test_dashboard_health_state_maps_stream_payload_and_camera_telemetry():
    state = DashboardHealthState()
    occurred_at = datetime(2026, 5, 6, 8, 0, tzinfo=timezone.utc)
    state.record_stream_health(
        payload={
            "status": "ok",
            "fps": 29.7,
            "latency_ms": 41.5,
            "stream_id": "cam-01",
            "camera_name": "Main Gate",
            "source_online": True,
        },
        occurred_at=occurred_at,
    )

    snapshot = state.snapshot(
        realtime_metrics=RealtimeMetrics(active_connections=0, dropped_messages=2),
        backend_ready=True,
    )

    assert snapshot.stream.status == "healthy"
    assert snapshot.stream.label == "ok"
    assert snapshot.stream.last_updated_at == occurred_at
    assert snapshot.stream.details["latency_ms"] == 41.5
    assert snapshot.camera_source.status == "healthy"
    assert snapshot.camera_source.label == "online"
    assert snapshot.camera_source.details["camera_name"] == "Main Gate"
    assert snapshot.realtime_ws.status == "degraded"
    assert snapshot.realtime_ws.label == "idle"
