"""Unified event feed API endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.application.interfaces.repositories.event_feed_repository import (
    EventFeedType,
    ReviewStatusFilter,
    SeverityFilter,
)
from app.application.use_cases.events import ListEventFeedQuery, ListEventFeedUseCase
from app.bootstrap.container import Container
from app.core.dependencies import get_admin_user, get_list_event_feed_use_case
from app.core.filter_policy import validate_event_filter_range
from app.core.dependencies import get_container
from app.presentation.schemas.events import EventFeedItemResponse, EventFeedListResponse

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_admin_user)])


@router.get("", response_model=EventFeedListResponse)
def list_event_feed(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    event_type: EventFeedType = Query(default=EventFeedType.ALL, alias="type"),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    q: str | None = Query(default=None),
    review_status: ReviewStatusFilter | None = Query(default=None),
    severity: SeverityFilter | None = Query(default=None),
    container: Container = Depends(get_container),
    use_case: ListEventFeedUseCase = Depends(get_list_event_feed_use_case),
) -> EventFeedListResponse:
    validate_event_filter_range(
        from_at=from_at,
        to_at=to_at,
        settings=container.settings,
    )
    result = use_case.execute(
        ListEventFeedQuery(
            page=page,
            page_size=page_size,
            event_type=event_type,
            from_at=from_at,
            to_at=to_at,
            query=q,
            review_status=review_status,
            severity=severity,
        )
    )
    return EventFeedListResponse(
        items=[EventFeedItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )
