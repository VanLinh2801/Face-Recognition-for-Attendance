"""Unknown event query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository
from app.core.exceptions import NotFoundError, ValidationError
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


@dataclass(slots=True, kw_only=True)
class UpdateUnknownEventReviewCommand:
    event_id: UUID
    review_status: UnknownEventReviewStatus | None = None
    review_status_provided: bool = False
    notes: str | None = None
    notes_provided: bool = False


class GetUnknownEventUseCase:
    def __init__(self, repository: UnknownEventRepository) -> None:
        self._repository = repository

    def execute(self, event_id: UUID) -> UnknownEvent:
        event = self._repository.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Unknown event not found")
        return event


class UpdateUnknownEventReviewUseCase:
    def __init__(self, repository: UnknownEventRepository) -> None:
        self._repository = repository

    def execute(self, command: UpdateUnknownEventReviewCommand) -> UnknownEvent:
        if not command.review_status_provided and not command.notes_provided:
            raise ValidationError("At least one field must be provided")
        event = self._repository.update_review(
            command.event_id,
            review_status=command.review_status,
            review_status_provided=command.review_status_provided,
            notes=command.notes,
            notes_provided=command.notes_provided,
        )
        if event is None:
            raise NotFoundError("Unknown event not found")
        return event
