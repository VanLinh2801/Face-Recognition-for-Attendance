"""Realtime outbound DTOs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any


class RealtimeChannel(StrEnum):
    EVENTS_BUSINESS = "events.business"
    STREAM_OVERLAY = "stream.overlay"
    STREAM_HEALTH = "stream.health"


@dataclass(slots=True, kw_only=True)
class RealtimeEnvelope:
    channel: RealtimeChannel
    event_type: str
    occurred_at: datetime
    correlation_id: str | None
    dedupe_key: str | None
    payload: dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_message(self) -> dict[str, Any]:
        return {
            "channel": self.channel.value,
            "event_type": self.event_type,
            "occurred_at": self.occurred_at.astimezone(timezone.utc).isoformat(),
            "correlation_id": self.correlation_id,
            "dedupe_key": self.dedupe_key,
            "payload": self.payload,
            "metadata": self.metadata,
        }
