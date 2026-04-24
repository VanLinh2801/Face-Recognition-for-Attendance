"""Event inbox repository abstraction for idempotency."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID


class EventInboxRepository(Protocol):
    def exists_message_id(self, message_id: UUID) -> bool: ...

    def add_processed_message(
        self,
        *,
        message_id: UUID,
        event_name: str,
        producer: str,
        occurred_at: datetime,
        status: str,
        details: dict | None = None,
    ) -> None: ...
