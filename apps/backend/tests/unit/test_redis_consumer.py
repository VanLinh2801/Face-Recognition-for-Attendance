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


class FakeValidator:
    def __init__(self, *, should_raise: bool = False) -> None:
        self.should_raise = should_raise
        self.calls = 0

    def validate(self, _envelope: dict[str, Any]) -> None:
        from app.core.exceptions import ValidationError

        self.calls += 1
        if self.should_raise:
            raise ValidationError("invalid contract")


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
    consumer.set_validator(FakeValidator())

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
    consumer.set_validator(FakeValidator())

    async def handler(_envelope: dict[str, Any], _payload: dict[str, Any]) -> bool:
        return False

    consumer.register_handler("spoof_alert.detected", handler)
    await consumer._handle_records([("pipeline.backend.events", [("301-0", {"event_name": "spoof_alert.detected"})])])
    assert consumer._client.acked == []


@pytest.mark.asyncio
async def test_consumer_does_not_ack_or_dispatch_when_validation_fails() -> None:
    settings = Settings(
        REDIS_STREAM_AI_EVENTS="ai.backend.events",
        REDIS_STREAM_PIPELINE_EVENTS="pipeline.backend.events",
        REDIS_CONSUMER_GROUP="backend-consumers",
        ENABLE_EVENT_CONSUMER=False,
    )
    consumer = RedisEventConsumer(settings)
    consumer._client = FakeRedisClient()  # type: ignore[assignment]
    consumer.set_validator(FakeValidator(should_raise=True))

    dispatched: list[dict[str, Any]] = []

    async def handler(envelope: dict[str, Any], payload: dict[str, Any]) -> bool:
        dispatched.append({"envelope": envelope, "payload": payload})
        return True

    consumer.register_handler("recognition_event.detected", handler)
    await consumer._handle_records(
        [("ai.backend.events", [("901-0", {"event_name": "recognition_event.detected", "payload": json.dumps({})})])]
    )

    assert dispatched == []
    assert consumer._client.acked == []


@pytest.mark.asyncio
async def test_consumer_acks_unknown_event_via_default_handler() -> None:
    settings = Settings(
        REDIS_STREAM_AI_EVENTS="ai.backend.events",
        REDIS_STREAM_PIPELINE_EVENTS="pipeline.backend.events",
        REDIS_CONSUMER_GROUP="backend-consumers",
        ENABLE_EVENT_CONSUMER=False,
    )
    consumer = RedisEventConsumer(settings)
    consumer._client = FakeRedisClient()  # type: ignore[assignment]
    consumer.set_validator(FakeValidator())

    await consumer._handle_records(
        [
            (
                "pipeline.backend.events",
                [("777-0", {"event_name": "stream.health.updated", "payload": json.dumps({"status": "ok"})})],
            )
        ]
    )

    assert consumer._client.acked == [("pipeline.backend.events", "backend-consumers", "777-0")]


@pytest.mark.asyncio
async def test_consumer_skips_invalid_json_payload_without_ack() -> None:
    settings = Settings(
        REDIS_STREAM_AI_EVENTS="ai.backend.events",
        REDIS_STREAM_PIPELINE_EVENTS="pipeline.backend.events",
        REDIS_CONSUMER_GROUP="backend-consumers",
        ENABLE_EVENT_CONSUMER=False,
    )
    consumer = RedisEventConsumer(settings)
    consumer._client = FakeRedisClient()  # type: ignore[assignment]
    consumer.set_validator(FakeValidator())

    await consumer._handle_records(
        [("ai.backend.events", [("778-0", {"event_name": "recognition_event.detected", "payload": "{bad json"})])]
    )

    assert consumer._client.acked == []
