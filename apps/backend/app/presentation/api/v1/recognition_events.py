"""Recognition event API endpoints."""

from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends, Query

from app.application.use_cases.recognition_events import (
    ListRecognitionEventsQuery,
    ListRecognitionEventsUseCase,
)
from app.core.dependencies import get_admin_user, get_list_recognition_events_use_case
from app.presentation.schemas.recognition_events import (
    RecognitionEventItemResponse,
    RecognitionEventListResponse,
)

router = APIRouter(
    prefix="/recognition-events",
    tags=["recognition-events"],
    dependencies=[Depends(get_admin_user)],
)


@router.get("", response_model=RecognitionEventListResponse)
def list_recognition_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    use_case: ListRecognitionEventsUseCase = Depends(get_list_recognition_events_use_case),
) -> RecognitionEventListResponse:
    result = use_case.execute(
        ListRecognitionEventsQuery(
            page=page,
            page_size=page_size,
            recognized_from=from_at,
            recognized_to=to_at,
        )
    )
    return RecognitionEventListResponse(
        items=[RecognitionEventItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )
