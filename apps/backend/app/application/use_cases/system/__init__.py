"""System read use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from app.infrastructure.integrations.dashboard_health_state import DashboardHealthState
from app.infrastructure.realtime.websocket_hub import RealtimeMetrics


class DashboardHealthComponentView(Protocol):
    status: str
    label: str
    last_updated_at: datetime | None
    details: dict[str, Any]


class DashboardHealthView(Protocol):
    backend: DashboardHealthComponentView
    realtime_ws: DashboardHealthComponentView
    stream: DashboardHealthComponentView
    camera_source: DashboardHealthComponentView


@dataclass(slots=True)
class GetDashboardHealthUseCase:
    health_state: DashboardHealthState

    def execute(
        self,
        *,
        realtime_metrics: RealtimeMetrics,
        backend_ready: bool,
    ) -> DashboardHealthView:
        return self.health_state.snapshot(
            realtime_metrics=realtime_metrics,
            backend_ready=backend_ready,
        )
