"""Spoof alert API endpoints."""

from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends, Query

from app.application.use_cases.spoof_alert_events import (
    ListSpoofAlertEventsQuery,
    ListSpoofAlertEventsUseCase,
)
from app.core.dependencies import get_admin_user, get_list_spoof_alert_events_use_case
from app.domain.shared.enums import SpoofReviewStatus
from app.presentation.schemas.spoof_alert_events import (
    SpoofAlertEventItemResponse,
    SpoofAlertEventListResponse,
)

router = APIRouter(prefix="/spoof-alert-events", tags=["spoof-alert-events"], dependencies=[Depends(get_admin_user)])


@router.get("", response_model=SpoofAlertEventListResponse)
def list_spoof_alert_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    review_status: SpoofReviewStatus | None = Query(default=None),
    use_case: ListSpoofAlertEventsUseCase = Depends(get_list_spoof_alert_events_use_case),
) -> SpoofAlertEventListResponse:
    result = use_case.execute(
        ListSpoofAlertEventsQuery(
            page=page,
            page_size=page_size,
            detected_from=from_at,
            detected_to=to_at,
            review_status=review_status,
        )
    )
    return SpoofAlertEventListResponse(
        items=[SpoofAlertEventItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )
