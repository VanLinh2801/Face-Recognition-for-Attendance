"""Realtime outbound DTOs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.domain.shared.enums import EventDirection, SpoofReviewStatus, SpoofSeverity, UnknownEventReviewStatus


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


@dataclass(slots=True, kw_only=True)
class RealtimeUnknownDetectedPayload:
    id: UUID
    detected_at: datetime
    event_direction: EventDirection
    match_score: float | None
    spoof_score: float | None
    event_source: str
    review_status: UnknownEventReviewStatus
    notes: str | None
    snapshot_media_asset_id: UUID | None
    track_id: str | None
    dedupe_key: str | None

    def to_message(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": str(self.id),
            "detected_at": self.detected_at.astimezone(timezone.utc).isoformat(),
            "event_direction": self.event_direction.value,
            "match_score": self.match_score,
            "spoof_score": self.spoof_score,
            "event_source": self.event_source,
            "review_status": self.review_status.value,
            "notes": self.notes,
            "snapshot_media_asset_id": str(self.snapshot_media_asset_id) if self.snapshot_media_asset_id is not None else None,
            "track_id": self.track_id,
            "dedupe_key": self.dedupe_key,
        }
        return payload


@dataclass(slots=True, kw_only=True)
class RealtimeSpoofDetectedPayload:
    id: UUID
    person_id: UUID | None
    person_name: str | None
    detected_at: datetime
    spoof_score: float
    severity: SpoofSeverity
    event_source: str
    review_status: SpoofReviewStatus
    notes: str | None
    snapshot_media_asset_id: UUID | None
    track_id: str | None
    dedupe_key: str | None

    def to_message(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": str(self.id),
            "person_id": str(self.person_id) if self.person_id is not None else None,
            "person_name": self.person_name,
            "detected_at": self.detected_at.astimezone(timezone.utc).isoformat(),
            "spoof_score": self.spoof_score,
            "severity": self.severity.value,
            "event_source": self.event_source,
            "review_status": self.review_status.value,
            "notes": self.notes,
            "snapshot_media_asset_id": str(self.snapshot_media_asset_id) if self.snapshot_media_asset_id is not None else None,
            "track_id": self.track_id,
            "dedupe_key": self.dedupe_key,
        }
        return payload
