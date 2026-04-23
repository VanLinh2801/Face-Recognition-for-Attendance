"""Spoof alert event query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.domain.shared.enums import SpoofReviewStatus
from app.domain.spoof_alert_events.entities import SpoofAlertEvent


@dataclass(slots=True, kw_only=True)
class ListSpoofAlertEventsQuery:
    page: int = 1
    page_size: int = 20
    detected_from: datetime | None = None
    detected_to: datetime | None = None
    review_status: SpoofReviewStatus | None = None


class ListSpoofAlertEventsUseCase:
    def __init__(self, repository: SpoofAlertEventRepository) -> None:
        self._repository = repository

    def execute(self, query: ListSpoofAlertEventsQuery) -> PageResult[SpoofAlertEvent]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_spoof_alert_events(
            page=page_query.page,
            page_size=page_query.page_size,
            detected_from=query.detected_from,
            detected_to=query.detected_to,
            review_status=query.review_status,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)
"""Spoof alert use cases."""
