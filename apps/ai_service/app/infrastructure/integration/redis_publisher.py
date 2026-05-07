import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisStreamPublisher:
    """
    Publishes event envelopes to Redis Streams.
    Envelope format follows packages/contracts/common/envelope.schema.json.
    """

    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None

    async def connect(self) -> None:
        self._client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info("Redis publisher connected: %s", settings.REDIS_URL)

    def build_envelope(
        self,
        event_name: str,
        payload: dict,
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
    ) -> dict:
        """Build a contract-compliant envelope. All timestamps are UTC ISO-8601."""
        return {
            "event_name": event_name,
            "event_version": "1.0.0",
            "message_id": str(uuid.uuid4()),
            "correlation_id": correlation_id or str(uuid.uuid4()),
            "causation_id": causation_id,
            "producer": "ai_service",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }

    async def publish(self, stream_name: str, envelope: dict) -> str:
        """
        Publish a pre-built envelope to a Redis Stream.
        Returns the Redis entry ID.
        """
        if self._client is None:
            raise RuntimeError("Call connect() before publish()")

        entry_id = await self._client.xadd(
            stream_name,
            {"data": json.dumps(envelope, default=str)},
        )
        logger.debug(
            "Published event_name=%s stream=%s entry_id=%s",
            envelope.get("event_name"),
            stream_name,
            entry_id,
        )
        return entry_id

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
