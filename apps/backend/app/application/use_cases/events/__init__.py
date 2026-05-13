"""Unified event feed use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.event_feed_repository import (
    EventFeedItem,
    EventFeedRepository,
    EventFeedType,
    ReviewStatusFilter,
    SeverityFilter,
)


@dataclass(slots=True, kw_only=True)
class ListEventFeedQuery:
    page: int = 1
    page_size: int = 20
    event_type: EventFeedType = EventFeedType.ALL
    from_at: datetime | None = None
    to_at: datetime | None = None
    query: str | None = None
    review_status: ReviewStatusFilter | None = None
    severity: SeverityFilter | None = None


class ListEventFeedUseCase:
    def __init__(self, repository: EventFeedRepository) -> None:
        self._repository = repository

    def execute(self, query: ListEventFeedQuery) -> PageResult[EventFeedItem]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_event_feed(
            page=page_query.page,
            page_size=page_query.page_size,
            event_type=query.event_type,
            from_at=query.from_at,
            to_at=query.to_at,
            query=query.query,
            review_status=query.review_status,
            severity=query.severity,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)
