"""Spoof alert event query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.core.exceptions import NotFoundError, ValidationError
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


@dataclass(slots=True, kw_only=True)
class UpdateSpoofAlertEventReviewCommand:
    event_id: UUID
    review_status: SpoofReviewStatus | None = None
    review_status_provided: bool = False
    notes: str | None = None
    notes_provided: bool = False


class GetSpoofAlertEventUseCase:
    def __init__(self, repository: SpoofAlertEventRepository) -> None:
        self._repository = repository

    def execute(self, event_id: UUID) -> SpoofAlertEvent:
        event = self._repository.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Spoof alert event not found")
        return event


class UpdateSpoofAlertEventReviewUseCase:
    def __init__(self, repository: SpoofAlertEventRepository) -> None:
        self._repository = repository

    def execute(self, command: UpdateSpoofAlertEventReviewCommand) -> SpoofAlertEvent:
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
            raise NotFoundError("Spoof alert event not found")
        return event
