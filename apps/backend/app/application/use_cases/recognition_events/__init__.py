"""Recognition event query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.recognition_event_repository import RecognitionEventRepository
from app.domain.recognition_events.entities import RecognitionEvent


@dataclass(slots=True, kw_only=True)
class ListRecognitionEventsQuery:
    page: int = 1
    page_size: int = 20
    recognized_from: datetime | None = None
    recognized_to: datetime | None = None


class ListRecognitionEventsUseCase:
    def __init__(self, repository: RecognitionEventRepository) -> None:
        self._repository = repository

    def execute(self, query: ListRecognitionEventsQuery) -> PageResult[RecognitionEvent]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_recognition_events(
            page=page_query.page,
            page_size=page_query.page_size,
            recognized_from=query.recognized_from,
            recognized_to=query.recognized_to,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)
"""Recognition event use cases."""
