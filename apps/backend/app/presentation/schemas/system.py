"""System transport schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EventFilterPolicyResponse(BaseModel):
    max_future_hours: int


class AttendanceFilterPolicyResponse(BaseModel):
    max_future_days: int


class FilterPolicyResponse(BaseModel):
    server_now: datetime
    retention_days: int
    events: EventFilterPolicyResponse
    attendance: AttendanceFilterPolicyResponse


class DashboardHealthComponentResponse(BaseModel):
    status: str
    label: str
    last_updated_at: datetime | None
    details: dict[str, Any]


class DashboardHealthResponse(BaseModel):
    backend: DashboardHealthComponentResponse
    realtime_ws: DashboardHealthComponentResponse
    stream: DashboardHealthComponentResponse
    camera_source: DashboardHealthComponentResponse
