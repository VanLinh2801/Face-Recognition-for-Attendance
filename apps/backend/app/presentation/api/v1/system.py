"""System API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.application.use_cases.system import GetDashboardHealthUseCase
from app.bootstrap.container import Container
from app.core.db import ping_database
from app.core.dependencies import get_admin_user, get_container, get_dashboard_health_use_case
from app.core.filter_policy import build_filter_policy
from app.presentation.schemas.system import (
    AttendanceFilterPolicyResponse,
    DashboardHealthResponse,
    EventFilterPolicyResponse,
    FilterPolicyResponse,
)

router = APIRouter(prefix="/system", tags=["system"], dependencies=[Depends(get_admin_user)])


@router.get("/filter-policy", response_model=FilterPolicyResponse)
def get_filter_policy(
    container: Container = Depends(get_container),
) -> FilterPolicyResponse:
    policy = build_filter_policy(container.settings)
    return FilterPolicyResponse(
        server_now=policy.server_now,
        retention_days=policy.retention_days,
        events=EventFilterPolicyResponse(max_future_hours=policy.events_max_future_hours),
        attendance=AttendanceFilterPolicyResponse(max_future_days=policy.attendance_max_future_days),
    )


@router.get("/dashboard-health", response_model=DashboardHealthResponse)
def get_dashboard_health(
    container: Container = Depends(get_container),
    use_case: GetDashboardHealthUseCase = Depends(get_dashboard_health_use_case),
) -> DashboardHealthResponse:
    return DashboardHealthResponse.model_validate(
        use_case.execute(
            realtime_metrics=container.websocket_hub.metrics,
            backend_ready=ping_database(container.engine),
        ),
        from_attributes=True,
    )
