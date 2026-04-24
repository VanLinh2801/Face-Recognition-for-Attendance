import json
from typing import Any

import pytest

from app.core.config import Settings
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer


class FakeRedisClient:
    def __init__(self) -> None:
        self.acked: list[tuple[str, str, str]] = []

    async def xack(self, stream: str, group: str, message_id: str) -> None:
        self.acked.append((stream, group, message_id))


@pytest.mark.asyncio
async def test_consumer_dispatches_event_and_acks() -> None:
    settings = Settings(
        REDIS_STREAM_AI_EVENTS="ai.backend.events",
        REDIS_STREAM_PIPELINE_EVENTS="pipeline.backend.events",
        REDIS_CONSUMER_GROUP="backend-consumers",
        ENABLE_EVENT_CONSUMER=False,
    )
    consumer = RedisEventConsumer(settings)
    consumer._client = FakeRedisClient()  # type: ignore[assignment]

    dispatched: list[dict[str, Any]] = []

    async def handler(envelope: dict[str, Any], payload: dict[str, Any]) -> bool:
        dispatched.append({"envelope": envelope, "payload": payload})
        return True

    consumer.register_handler("recognition_event.detected", handler)
    record_payload = {
        "event_name": "recognition_event.detected",
        "event_version": "1.0.0",
        "payload": json.dumps({"person_id": "abc"}),
    }
    await consumer._handle_records(  # noqa: SLF001 - intentional unit test for dispatch
        [("ai.backend.events", [("171-0", record_payload)])]
    )

    assert len(dispatched) == 1
    assert dispatched[0]["payload"]["person_id"] == "abc"
    assert consumer._client.acked == [("ai.backend.events", "backend-consumers", "171-0")]


@pytest.mark.asyncio
async def test_consumer_does_not_ack_when_handler_returns_false() -> None:
    settings = Settings(
        REDIS_STREAM_AI_EVENTS="ai.backend.events",
        REDIS_STREAM_PIPELINE_EVENTS="pipeline.backend.events",
        REDIS_CONSUMER_GROUP="backend-consumers",
        ENABLE_EVENT_CONSUMER=False,
    )
    consumer = RedisEventConsumer(settings)
    consumer._client = FakeRedisClient()  # type: ignore[assignment]

    async def handler(_envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        return False

    consumer.register_handler("spoof_alert.detected", handler)
    await consumer._handle_records([("pipeline.backend.events", [("301-0", {"event_name": "spoof_alert.detected"})])])
    assert consumer._client.acked == []
