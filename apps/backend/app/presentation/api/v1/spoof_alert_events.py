"""Spoof alert API endpoints."""

from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends, Query

from uuid import UUID

from app.application.use_cases.spoof_alert_events import (
    ListSpoofAlertEventsQuery,
    ListSpoofAlertEventsUseCase,
    UpdateSpoofAlertEventReviewCommand,
    UpdateSpoofAlertEventReviewUseCase,
)
from app.core.exceptions import ValidationError
from app.core.dependencies import (
    get_admin_user,
    get_list_spoof_alert_events_use_case,
    get_unit_of_work,
    get_update_spoof_alert_event_review_use_case,
)
from app.domain.shared.enums import SpoofReviewStatus
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.spoof_alert_events import (
    SpoofAlertEventItemResponse,
    SpoofAlertEventListResponse,
    UpdateSpoofAlertEventReviewRequest,
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


@router.patch("/{event_id}", response_model=SpoofAlertEventItemResponse)
def update_spoof_alert_event_review(
    event_id: UUID,
    request: UpdateSpoofAlertEventReviewRequest,
    use_case: UpdateSpoofAlertEventReviewUseCase = Depends(get_update_spoof_alert_event_review_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> SpoofAlertEventItemResponse:
    if not request.model_fields_set:
        raise ValidationError("At least one field must be provided")
    item = use_case.execute(
        UpdateSpoofAlertEventReviewCommand(
            event_id=event_id,
            review_status=request.review_status,
            review_status_provided="review_status" in request.model_fields_set,
            notes=request.notes,
            notes_provided="notes" in request.model_fields_set,
        )
    )
    uow.commit()
    return SpoofAlertEventItemResponse.model_validate(item, from_attributes=True)
