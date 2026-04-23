"""Pipeline integration client."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from redis.asyncio import Redis

from app.core.config import Settings


class PipelineEventPublisher:
    """Publisher for backend -> pipeline events over Redis Streams."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = Redis.from_url(settings.redis_url, decode_responses=True)

    async def publish_registration_requested(
        self,
        *,
        person_id: UUID,
        registration_id: UUID,
        requested_by_person_id: UUID,
        source_media_asset: dict,
        notes: str | None = None,
        correlation_id: UUID | None = None,
    ) -> dict[str, str]:
        message_id = str(uuid4())
        corr_id = str(correlation_id or uuid4())
        envelope = {
            "event_name": "registration.requested",
            "event_version": "1.0.0",
            "message_id": message_id,
            "correlation_id": corr_id,
            "causation_id": None,
            "producer": "backend",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "person_id": str(person_id),
                "registration_id": str(registration_id),
                "requested_by_person_id": str(requested_by_person_id),
                "source_media_asset": source_media_asset,
                "notes": notes,
            },
        }
        stream_id = await self._client.xadd(
            self._settings.redis_stream_backend_pipeline,
            {"envelope": json.dumps(envelope)},
        )
        return {
            "stream_id": stream_id,
            "message_id": message_id,
            "correlation_id": corr_id,
        }

    async def close(self) -> None:
        await self._client.close()
