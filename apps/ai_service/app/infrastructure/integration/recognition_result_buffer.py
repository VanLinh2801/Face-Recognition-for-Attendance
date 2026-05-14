import asyncio
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings
from app.infrastructure.integration.redis_publisher import RedisStreamPublisher

logger = logging.getLogger(__name__)


class RecognitionResultBuffer:
    """
    Buffers recognition candidates for the same track and publishes only the best one.

    Selection:
      1. Prefer KNOWN over UNKNOWN.
      2. Within the same decision type, prefer higher match/nearest score.
      3. Tie-break by detection confidence, then frame sequence.
    """

    def __init__(self, publisher: RedisStreamPublisher) -> None:
        self._publisher = publisher
        self._client: aioredis.Redis | None = None
        self._timers: dict[str, asyncio.Task] = {}

    async def connect(self) -> None:
        self._client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info(
            "Recognition result buffer connected ttl=%ss expected_candidates=%s",
            settings.RECOGNITION_BUFFER_TTL_SECONDS,
            settings.RECOGNITION_BUFFER_EXPECTED_CANDIDATES,
        )

    async def close(self) -> None:
        for task in self._timers.values():
            task.cancel()
        self._timers.clear()
        if self._client:
            await self._client.aclose()

    async def add_candidate(
        self,
        *,
        stream_id: str,
        track_id: str,
        candidate: dict[str, Any],
    ) -> None:
        if self._client is None:
            raise RuntimeError("Call connect() before add_candidate()")

        key = self._buffer_key(stream_id, track_id)
        published_key = self._published_key(stream_id, track_id)

        if await self._client.exists(published_key):
            logger.info(
                "Skipping late recognition candidate stream_id=%s track_id=%s",
                stream_id,
                track_id,
            )
            return

        encoded = json.dumps(candidate, default=str)
        count = await self._client.rpush(key, encoded)
        await self._client.expire(key, settings.RECOGNITION_BUFFER_TTL_SECONDS + 2)

        logger.info(
            "Buffered recognition candidate stream_id=%s track_id=%s count=%s decision=%s score=%s",
            stream_id,
            track_id,
            count,
            candidate.get("decision"),
            candidate.get("score"),
        )

        if count == 1:
            self._schedule_timeout_flush(stream_id, track_id, key)

        if count >= settings.RECOGNITION_BUFFER_EXPECTED_CANDIDATES:
            await self.flush(stream_id=stream_id, track_id=track_id, reason="candidate_count")

    async def flush(self, *, stream_id: str, track_id: str, reason: str) -> None:
        if self._client is None:
            raise RuntimeError("Call connect() before flush()")

        key = self._buffer_key(stream_id, track_id)
        lock_key = f"{key}:lock"
        published_key = self._published_key(stream_id, track_id)

        lock_acquired = await self._client.set(lock_key, "1", nx=True, ex=5)
        if not lock_acquired:
            return

        try:
            if await self._client.exists(published_key):
                await self._client.delete(key)
                return

            raw_candidates = await self._client.lrange(key, 0, -1)
            if not raw_candidates:
                return

            candidates = [json.loads(item) for item in raw_candidates]
            winner = self._select_winner(candidates)
            envelope = winner["envelope"]

            await self._publisher.publish(settings.REDIS_STREAM_AI_BACKEND, envelope)
            await self._client.delete(key)
            await self._client.set(
                published_key,
                "1",
                ex=settings.RECOGNITION_BUFFER_PUBLISHED_TTL_SECONDS,
            )

            logger.info(
                "Published buffered recognition winner stream_id=%s track_id=%s reason=%s "
                "event=%s candidates=%s decision=%s score=%s",
                stream_id,
                track_id,
                reason,
                envelope.get("event_name"),
                len(candidates),
                winner.get("decision"),
                winner.get("score"),
            )
        finally:
            await self._client.delete(lock_key)
            task = self._timers.pop(key, None)
            if task and not task.done():
                task.cancel()

    def _schedule_timeout_flush(self, stream_id: str, track_id: str, key: str) -> None:
        existing = self._timers.get(key)
        if existing and not existing.done():
            return

        async def delayed_flush() -> None:
            try:
                await asyncio.sleep(settings.RECOGNITION_BUFFER_TTL_SECONDS)
                await self.flush(stream_id=stream_id, track_id=track_id, reason="timeout")
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.error(
                    "Recognition buffer timeout flush failed stream_id=%s track_id=%s: %s",
                    stream_id,
                    track_id,
                    exc,
                    exc_info=True,
                )

        self._timers[key] = asyncio.create_task(delayed_flush())

    @staticmethod
    def _select_winner(candidates: list[dict[str, Any]]) -> dict[str, Any]:
        def rank(candidate: dict[str, Any]) -> tuple[float, float, float, float]:
            is_known = 1.0 if candidate.get("decision") == "KNOWN" else 0.0
            return (
                is_known,
                float(candidate.get("score") or 0.0),
                float(candidate.get("detection_confidence") or 0.0),
                float(candidate.get("frame_sequence") or 0.0),
            )

        return max(candidates, key=rank)

    @staticmethod
    def _buffer_key(stream_id: str, track_id: str) -> str:
        return f"recognition:candidates:{stream_id}:{track_id}"

    @staticmethod
    def _published_key(stream_id: str, track_id: str) -> str:
        return f"recognition:published:{stream_id}:{track_id}"
