from __future__ import annotations

from types import SimpleNamespace

from app.application.use_cases.event_ingestion import IngestResult, IngestStatus
from app.infrastructure.integrations.event_handlers import BackendEventHandlers


class _FakeSession:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None


class _FakeSessionFactory:
    def __call__(self):
        return _FakeSession()


class _FakeBus:
    def __init__(self) -> None:
        self.published = 0

    async def publish(self, _envelope):
        self.published += 1


class _FakeUseCase:
    def __init__(self, status: IngestStatus) -> None:
        self._status = status

    def execute(self, _envelope):
        return IngestResult(status=self._status)


async def _run_handler_with_status(status: IngestStatus) -> int:
    bus = _FakeBus()
    container = SimpleNamespace(
        session_factory=_FakeSessionFactory(),
        create_uow=lambda _session: object(),
        realtime_event_bus=bus,
        build_ingest_recognition_event_use_case=lambda _session, _uow: _FakeUseCase(status),
    )
    handler = BackendEventHandlers(container).handle_recognition_event
    await handler(
        {
            "event_name": "recognition_event.detected",
            "message_id": "m-1",
            "correlation_id": "c-1",
            "producer": "ai_service",
            "occurred_at": "2026-04-24T00:00:00Z",
            "payload": {"dedupe_key": "d-1"},
        },
        {},
    )
    return bus.published


def test_emit_only_when_processed():
    import anyio

    published_processed = anyio.run(_run_handler_with_status, IngestStatus.PROCESSED)
    published_duplicate = anyio.run(_run_handler_with_status, IngestStatus.DUPLICATE)
    assert published_processed == 1
    assert published_duplicate == 0
