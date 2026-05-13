"""Unknown event API endpoints."""

from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends, Query

from uuid import UUID

from app.application.use_cases.unknown_events import (
    ListUnknownEventsQuery,
    ListUnknownEventsUseCase,
    UpdateUnknownEventReviewCommand,
    UpdateUnknownEventReviewUseCase,
)
from app.core.exceptions import ValidationError
from app.core.dependencies import (
    get_admin_user,
    get_list_unknown_events_use_case,
    get_unit_of_work,
    get_update_unknown_event_review_use_case,
)
from app.domain.shared.enums import UnknownEventReviewStatus
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.unknown_events import UnknownEventItemResponse, UnknownEventListResponse
from app.presentation.schemas.unknown_events import UpdateUnknownEventReviewRequest

router = APIRouter(prefix="/unknown-events", tags=["unknown-events"], dependencies=[Depends(get_admin_user)])


@router.get("", response_model=UnknownEventListResponse)
def list_unknown_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    review_status: UnknownEventReviewStatus | None = Query(default=None),
    use_case: ListUnknownEventsUseCase = Depends(get_list_unknown_events_use_case),
) -> UnknownEventListResponse:
    result = use_case.execute(
        ListUnknownEventsQuery(
            page=page,
            page_size=page_size,
            detected_from=from_at,
            detected_to=to_at,
            review_status=review_status,
        )
    )
    return UnknownEventListResponse(
        items=[UnknownEventItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.patch("/{event_id}", response_model=UnknownEventItemResponse)
def update_unknown_event_review(
    event_id: UUID,
    request: UpdateUnknownEventReviewRequest,
    use_case: UpdateUnknownEventReviewUseCase = Depends(get_update_unknown_event_review_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> UnknownEventItemResponse:
    if not request.model_fields_set:
        raise ValidationError("At least one field must be provided")
    item = use_case.execute(
        UpdateUnknownEventReviewCommand(
            event_id=event_id,
            review_status=request.review_status,
            review_status_provided="review_status" in request.model_fields_set,
            notes=request.notes,
            notes_provided="notes" in request.model_fields_set,
        )
    )
    uow.commit()
    return UnknownEventItemResponse.model_validate(item, from_attributes=True)
