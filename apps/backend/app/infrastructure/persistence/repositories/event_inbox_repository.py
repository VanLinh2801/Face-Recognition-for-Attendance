"""SQLAlchemy event inbox repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.event_inbox_repository import EventInboxRepository
from app.infrastructure.persistence.models.event_inbox_model import EventInboxModel


class SqlAlchemyEventInboxRepository(EventInboxRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def exists_message_id(self, message_id: UUID) -> bool:
        stmt = select(EventInboxModel.id).where(EventInboxModel.message_id == message_id)
        return self._session.execute(stmt).scalar_one_or_none() is not None

    def add_processed_message(
        self,
        *,
        message_id: UUID,
        event_name: str,
        producer: str,
        occurred_at: datetime,
        status: str,
        details: dict | None = None,
    ) -> None:
        self._session.add(
            EventInboxModel(
                id=uuid4(),
                message_id=message_id,
                event_name=event_name,
                producer=producer,
                occurred_at=occurred_at,
                status=status,
                processed_at=datetime.now(timezone.utc),
                details=details,
            )
        )
