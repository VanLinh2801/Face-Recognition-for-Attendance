"""Recognition event repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.recognition_events.entities import RecognitionEvent


class RecognitionEventRepository(Protocol):
    """Read abstraction for recognition events."""

    def list_recognition_events(
        self,
        *,
        page: int,
        page_size: int,
        recognized_from: datetime | None = None,
        recognized_to: datetime | None = None,
    ) -> tuple[list[RecognitionEvent], int]: ...
