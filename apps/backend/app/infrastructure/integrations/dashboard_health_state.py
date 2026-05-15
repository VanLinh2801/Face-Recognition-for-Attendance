"""Runtime dashboard health state derived from stream health telemetry."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from app.infrastructure.realtime.websocket_hub import RealtimeMetrics


HealthStatus = str


@dataclass(slots=True)
class DashboardHealthComponent:
    status: HealthStatus
    label: str
    last_updated_at: datetime | None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class DashboardHealthSnapshot:
    backend: DashboardHealthComponent
    realtime_ws: DashboardHealthComponent
    stream: DashboardHealthComponent
    camera_source: DashboardHealthComponent


class DashboardHealthState:
    def __init__(self) -> None:
        self._lock = Lock()
        self._stream_payload: dict[str, Any] | None = None
        self._stream_updated_at: datetime | None = None

    def record_stream_health(self, *, payload: dict[str, Any], occurred_at: datetime) -> None:
        with self._lock:
            self._stream_payload = dict(payload)
            self._stream_updated_at = occurred_at.astimezone(timezone.utc)

    def snapshot(
        self,
        *,
        realtime_metrics: RealtimeMetrics,
        backend_ready: bool,
    ) -> DashboardHealthSnapshot:
        now = datetime.now(timezone.utc)
        with self._lock:
            payload = dict(self._stream_payload or {})
            stream_updated_at = self._stream_updated_at

        backend = DashboardHealthComponent(
            status="healthy" if backend_ready else "offline",
            label="ready" if backend_ready else "offline",
            last_updated_at=now,
            details={"database_ready": backend_ready},
        )

        realtime_status = "degraded" if realtime_metrics.dropped_messages > 0 else "healthy"
        realtime_label = "active" if realtime_metrics.active_connections > 0 else "idle"
        realtime_ws = DashboardHealthComponent(
            status=realtime_status,
            label=realtime_label,
            last_updated_at=now,
            details={
                "active_connections": realtime_metrics.active_connections,
                "sent_messages": realtime_metrics.sent_messages,
                "dropped_messages": realtime_metrics.dropped_messages,
                "disconnect_slow_client": realtime_metrics.disconnect_slow_client,
            },
        )

        stream = self._build_stream_component(payload, stream_updated_at)
        camera_source = self._build_camera_component(payload, stream_updated_at)
        return DashboardHealthSnapshot(
            backend=backend,
            realtime_ws=realtime_ws,
            stream=stream,
            camera_source=camera_source,
        )

    def _build_stream_component(
        self,
        payload: dict[str, Any],
        updated_at: datetime | None,
    ) -> DashboardHealthComponent:
        raw_status = payload.get("status")
        normalized_status = self._normalize_status(raw_status)
        fps = self._as_float(payload.get("fps"))
        latency_ms = self._as_float(payload.get("latency_ms"))
        label = self._coerce_label(raw_status, fallback="unknown")
        if updated_at is None:
            normalized_status = "unknown"
            label = "unknown"

        return DashboardHealthComponent(
            status=normalized_status,
            label=label,
            last_updated_at=updated_at,
            details={
                "fps": fps,
                "latency_ms": latency_ms,
                "stream_id": self._as_str(payload.get("stream_id")),
                "camera_name": self._as_str(payload.get("camera_name")),
                "source_online": self._as_bool(payload.get("source_online")),
            },
        )

    def _build_camera_component(
        self,
        payload: dict[str, Any],
        updated_at: datetime | None,
    ) -> DashboardHealthComponent:
        source_online = self._as_bool(payload.get("source_online"))
        if updated_at is None or source_online is None:
            status = "unknown"
            label = "unknown"
        else:
            status = "healthy" if source_online else "offline"
            label = "online" if source_online else "offline"

        return DashboardHealthComponent(
            status=status,
            label=label,
            last_updated_at=updated_at,
            details={
                "fps": self._as_float(payload.get("fps")),
                "latency_ms": self._as_float(payload.get("latency_ms")),
                "stream_id": self._as_str(payload.get("stream_id")),
                "camera_name": self._as_str(payload.get("camera_name")),
                "source_online": source_online,
            },
        )

    @staticmethod
    def _normalize_status(value: Any) -> HealthStatus:
        if not isinstance(value, str):
            return "unknown"
        normalized = value.strip().lower()
        if normalized in {"ok", "healthy", "online", "ready"}:
            return "healthy"
        if normalized in {"degraded", "warning", "warn"}:
            return "degraded"
        if normalized in {"offline", "error", "down"}:
            return "offline"
        return "unknown"

    @staticmethod
    def _coerce_label(value: Any, *, fallback: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
        return fallback

    @staticmethod
    def _as_str(value: Any) -> str | None:
        return value if isinstance(value, str) and value.strip() else None

    @staticmethod
    def _as_bool(value: Any) -> bool | None:
        return value if isinstance(value, bool) else None

    @staticmethod
    def _as_float(value: Any) -> float | None:
        if isinstance(value, (int, float)):
            return float(value)
        return None
