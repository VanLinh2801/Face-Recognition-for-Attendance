"""Unknown event query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository
from app.domain.shared.enums import UnknownEventReviewStatus
from app.domain.unknown_events.entities import UnknownEvent


@dataclass(slots=True, kw_only=True)
class ListUnknownEventsQuery:
    page: int = 1
    page_size: int = 20
    detected_from: datetime | None = None
    detected_to: datetime | None = None
    review_status: UnknownEventReviewStatus | None = None


class ListUnknownEventsUseCase:
    def __init__(self, repository: UnknownEventRepository) -> None:
        self._repository = repository

    def execute(self, query: ListUnknownEventsQuery) -> PageResult[UnknownEvent]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_unknown_events(
            page=page_query.page,
            page_size=page_query.page_size,
            detected_from=query.detected_from,
            detected_to=query.detected_to,
            review_status=query.review_status,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)
"""Unknown event use cases."""
