"""Attendance API endpoints."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.application.use_cases.attendance import (
    GetAttendanceDailySummaryUseCase,
    GetAttendanceEventUseCase,
    ListAttendanceEventsQuery,
    ListAttendanceEventsUseCase,
    ListPersonAttendanceHistoryQuery,
    ListPersonAttendanceHistoryUseCase,
)
from app.core.dependencies import (
    get_get_attendance_daily_summary_use_case,
    get_get_attendance_event_use_case,
    get_list_attendance_events_use_case,
    get_list_person_attendance_history_use_case,
)
from app.presentation.schemas.attendance import (
    AttendanceDailySummaryResponse,
    AttendanceEventItemResponse,
    AttendanceEventListResponse,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/events", response_model=AttendanceEventListResponse)
def list_attendance_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    person_id: UUID | None = Query(default=None),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    use_case: ListAttendanceEventsUseCase = Depends(get_list_attendance_events_use_case),
) -> AttendanceEventListResponse:
    result = use_case.execute(
        ListAttendanceEventsQuery(
            page=page,
            page_size=page_size,
            person_id=person_id,
            from_at=from_at,
            to_at=to_at,
        )
    )
    return AttendanceEventListResponse(
        items=[AttendanceEventItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.get("/events/{event_id}", response_model=AttendanceEventItemResponse)
def get_attendance_event(
    event_id: UUID,
    use_case: GetAttendanceEventUseCase = Depends(get_get_attendance_event_use_case),
) -> AttendanceEventItemResponse:
    return AttendanceEventItemResponse.model_validate(use_case.execute(event_id), from_attributes=True)


@router.get("/persons/{person_id}/history", response_model=AttendanceEventListResponse)
def list_person_attendance_history(
    person_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    use_case: ListPersonAttendanceHistoryUseCase = Depends(get_list_person_attendance_history_use_case),
) -> AttendanceEventListResponse:
    result = use_case.execute(
        ListPersonAttendanceHistoryQuery(
            person_id=person_id,
            page=page,
            page_size=page_size,
            from_at=from_at,
            to_at=to_at,
        )
    )
    return AttendanceEventListResponse(
        items=[AttendanceEventItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.get("/summary/daily", response_model=AttendanceDailySummaryResponse)
def get_daily_summary(
    work_date: date = Query(),
    use_case: GetAttendanceDailySummaryUseCase = Depends(get_get_attendance_daily_summary_use_case),
) -> AttendanceDailySummaryResponse:
    return AttendanceDailySummaryResponse.model_validate(use_case.execute(work_date), from_attributes=True)
