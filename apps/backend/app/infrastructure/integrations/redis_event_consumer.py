"""Redis Streams consumer skeleton for inbound AI events."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from app.core.config import Settings

logger = logging.getLogger(__name__)

EventHandler = Callable[[dict[str, Any], dict[str, Any]], Awaitable[None]]


@dataclass(slots=True)
class RedisEventConsumer:
    """Consume and dispatch events from Redis Streams."""

    settings: Settings
    _client: Redis | None = field(init=False, default=None)
    _task: asyncio.Task[None] | None = field(init=False, default=None)
    _stop_event: asyncio.Event = field(init=False, default_factory=asyncio.Event)
    _handlers: dict[str, EventHandler] = field(init=False, default_factory=dict)

    def register_handler(self, event_name: str, handler: EventHandler) -> None:
        self._handlers[event_name] = handler

    async def start(self) -> None:
        self._client = Redis.from_url(self.settings.redis_url, decode_responses=True)
        await self._ensure_group()
        self._stop_event.clear()
        self._task = asyncio.create_task(self._consume_loop())
        logger.info("Redis consumer started for stream=%s", self.settings.redis_stream_ai_events)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
        if self._client:
            await self._client.close()
        logger.info("Redis consumer stopped")

    async def _ensure_group(self) -> None:
        assert self._client is not None
        try:
            await self._client.xgroup_create(
                name=self.settings.redis_stream_ai_events,
                groupname=self.settings.redis_consumer_group,
                id="$",
                mkstream=True,
            )
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def _consume_loop(self) -> None:
        assert self._client is not None
        while not self._stop_event.is_set():
            try:
                records = await self._client.xreadgroup(
                    groupname=self.settings.redis_consumer_group,
                    consumername=self.settings.redis_consumer_name,
                    streams={self.settings.redis_stream_ai_events: ">"},
                    count=self.settings.redis_batch_size,
                    block=self.settings.redis_block_ms,
                )
                await self._handle_records(records)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Redis consumer loop error")
                await asyncio.sleep(1)

    async def _handle_records(self, records: list[tuple[str, list[tuple[str, dict[str, str]]]]]) -> None:
        assert self._client is not None
        for _stream_name, stream_messages in records:
            for message_id, raw_data in stream_messages:
                envelope = self._parse_envelope(raw_data)
                payload = envelope.get("payload", {})
                event_name = envelope.get("event_name", "unknown")
                handler = self._handlers.get(event_name, self._default_handler)
                await handler(envelope, payload)
                await self._client.xack(
                    self.settings.redis_stream_ai_events,
                    self.settings.redis_consumer_group,
                    message_id,
                )

    @staticmethod
    def _parse_envelope(raw_data: dict[str, str]) -> dict[str, Any]:
        raw_envelope = raw_data.get("envelope")
        if raw_envelope:
            return json.loads(raw_envelope)
        return {
            "event_name": raw_data.get("event_name"),
            "event_version": raw_data.get("event_version"),
            "message_id": raw_data.get("message_id"),
            "correlation_id": raw_data.get("correlation_id"),
            "producer": raw_data.get("producer"),
            "occurred_at": raw_data.get("occurred_at"),
            "payload": json.loads(raw_data["payload"]) if "payload" in raw_data else {},
        }

    async def _default_handler(self, envelope: dict[str, Any], payload: dict[str, Any]) -> None:
        logger.info(
            "Received event=%s version=%s payload_keys=%s",
            envelope.get("event_name"),
            envelope.get("event_version"),
            sorted(payload.keys()),
        )
