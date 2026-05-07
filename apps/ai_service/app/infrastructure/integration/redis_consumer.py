import asyncio
import json
import logging
from typing import Awaitable, Callable

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

MessageHandler = Callable[[dict], Awaitable[None]]


class RedisStreamConsumer:
    """
    Generic Redis Streams consumer using consumer groups.
    Supports graceful shutdown and auto-ack on successful processing.
    Failed messages are logged but NOT acked (they stay in PEL for future retry).
    """

    def __init__(
        self,
        stream_name: str,
        group_name: str,
        consumer_name: str,
    ) -> None:
        self._stream = stream_name
        self._group = group_name
        self._consumer = consumer_name
        self._client: aioredis.Redis | None = None
        self._running = False

    async def connect(self) -> None:
        self._client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await self._client.xgroup_create(
                self._stream, self._group, id="0", mkstream=True
            )
            logger.info(
                "Consumer group '%s' created on stream '%s'", self._group, self._stream
            )
        except Exception as exc:
            if "BUSYGROUP" in str(exc):
                logger.debug("Consumer group '%s' already exists", self._group)
            else:
                raise

    async def consume(self, handler: MessageHandler) -> None:
        if self._client is None:
            raise RuntimeError("Call connect() before consume()")

        self._running = True
        logger.info(
            "Consuming stream='%s' group='%s' consumer='%s'",
            self._stream,
            self._group,
            self._consumer,
        )

        while self._running:
            try:
                messages = await self._client.xreadgroup(
                    groupname=self._group,
                    consumername=self._consumer,
                    streams={self._stream: ">"},
                    count=10,
                    block=2000,  # ms — yields control when idle
                )
                if not messages:
                    continue

                for _stream_name, entries in messages:
                    for entry_id, data in entries:
                        try:
                            payload = json.loads(data.get("envelope", "{}"))
                            await handler(payload)
                            await self._client.xack(self._stream, self._group, entry_id)
                        except Exception as exc:
                            logger.error(
                                "Error processing entry_id=%s: %s",
                                entry_id,
                                exc,
                                exc_info=True,
                            )

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Consumer loop error: %s", exc, exc_info=True)
                if "NOGROUP" in str(exc):
                    logger.info("Consumer group missing, attempting to reconnect/recreate...")
                    await self.connect()
                await asyncio.sleep(1)

        logger.info("Consumer stopped stream='%s'", self._stream)

    async def stop(self) -> None:
        self._running = False
        if self._client:
            await self._client.aclose()
