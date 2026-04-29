"""Backend service entrypoint."""

from __future__ import annotations

import logging
import asyncio
from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.bootstrap.container import Container, build_container
from app.bootstrap.logging import configure_logging
from app.core.db import ping_database
from app.core.exceptions import AppError, InfrastructureError
from app.core.security import hash_password
from app.application.use_cases.event_ingestion import IngestStatus
from app.application.use_cases.media_assets import CleanupMediaAssetsCommand
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository
from app.presentation.api.router import api_router
from app.presentation.schemas.common import ErrorResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown resources."""
    container = build_container()
    configure_logging(container.settings.log_level)
    app.state.container = container
    app.state.redis_consumer = None
    app.state.media_cleanup_task = None
    app.state.websocket_hub = container.websocket_hub
    _seed_admin_user_if_configured(container)

    if container.settings.enable_event_consumer:
        consumer = RedisEventConsumer(container.settings)
        consumer.register_handler("recognition_event.detected", _build_recognition_ingest_handler(container))
        consumer.register_handler("unknown_event.detected", _build_unknown_ingest_handler(container))
        consumer.register_handler("spoof_alert.detected", _build_spoof_ingest_handler(container))
        consumer.register_handler("frame_analysis.updated", _build_overlay_relay_handler(container))
        consumer.register_handler("stream.health.updated", _build_stream_health_relay_handler(container))
        await consumer.start()
        app.state.redis_consumer = consumer

    if container.settings.media_cleanup_enabled:
        app.state.media_cleanup_task = asyncio.create_task(_run_media_cleanup_scheduler(container))

    logger.info("Backend service started")
    try:
        yield
    finally:
        consumer: RedisEventConsumer | None = app.state.redis_consumer
        cleanup_task: asyncio.Task[None] | None = app.state.media_cleanup_task
        if cleanup_task is not None:
            cleanup_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await cleanup_task
        if consumer is not None:
            await consumer.stop()
        container.engine.dispose()
        logger.info("Backend service stopped")


app = FastAPI(title="Backend Service", version="0.1.0", lifespan=lifespan)
app.include_router(api_router)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id", str(uuid4()))
    request.state.correlation_id = correlation_id
    started_at = perf_counter()

    response = await call_next(request)
    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    response.headers["x-correlation-id"] = correlation_id
    logger.info(
        "HTTP %s %s -> %s (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        extra={"correlation_id": correlation_id},
    )
    return response


@app.get("/health/live")
async def health_live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready(request: Request) -> dict[str, str]:
    container = request.app.state.container
    if not ping_database(container.engine):
        raise InfrastructureError("Database is not reachable")
    return {"status": "ready"}


@app.get("/health/realtime")
async def health_realtime(request: Request) -> dict[str, int]:
    hub = request.app.state.websocket_hub
    metrics = hub.metrics
    return {
        "active_connections": metrics.active_connections,
        "sent_messages": metrics.sent_messages,
        "dropped_messages": metrics.dropped_messages,
        "disconnect_slow_client": metrics.disconnect_slow_client,
    }


@app.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    payload = ErrorResponse(code=exc.code, message=str(exc), details=exc.details)
    status_code = (
        404
        if exc.code == "not_found"
        else 422
        if exc.code == "validation_error"
        else 409
        if exc.code == "conflict"
        else 500
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", exc_info=exc)
    payload = ErrorResponse(code="internal_error", message="Internal server error", details=None)
    return JSONResponse(status_code=500, content=payload.model_dump())


def _build_recognition_ingest_handler(container):
    async def _handler(envelope: dict, _payload: dict) -> bool:
        with container.session_factory() as session:
            uow = container.create_uow(session)
            use_case = container.build_ingest_recognition_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await container.realtime_event_bus.publish(
                    _to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="recognition_event.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest recognition result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    return _handler


def _build_unknown_ingest_handler(container):
    async def _handler(envelope: dict, _payload: dict) -> bool:
        with container.session_factory() as session:
            uow = container.create_uow(session)
            use_case = container.build_ingest_unknown_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await container.realtime_event_bus.publish(
                    _to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="unknown_event.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest unknown result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    return _handler


def _build_spoof_ingest_handler(container):
    async def _handler(envelope: dict, _payload: dict) -> bool:
        with container.session_factory() as session:
            uow = container.create_uow(session)
            use_case = container.build_ingest_spoof_alert_event_use_case(session, uow)
            result = use_case.execute(envelope)
            if result.status == IngestStatus.PROCESSED:
                await container.realtime_event_bus.publish(
                    _to_realtime_envelope(
                        channel=RealtimeChannel.EVENTS_BUSINESS,
                        event_type="spoof_alert.detected",
                        envelope=envelope,
                    )
                )
            logger.info(
                "ingest spoof result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    return _handler


def _build_overlay_relay_handler(container: Container):
    async def _handler(envelope: dict, _payload: dict) -> bool:
        await container.realtime_event_bus.publish(
            _to_realtime_envelope(
                channel=RealtimeChannel.STREAM_OVERLAY,
                event_type="frame_analysis.updated",
                envelope=envelope,
            )
        )
        return True

    return _handler


def _build_stream_health_relay_handler(container: Container):
    async def _handler(envelope: dict, _payload: dict) -> bool:
        await container.realtime_event_bus.publish(
            _to_realtime_envelope(
                channel=RealtimeChannel.STREAM_HEALTH,
                event_type="stream.health.updated",
                envelope=envelope,
            )
        )
        return True

    return _handler


def _to_realtime_envelope(*, channel: RealtimeChannel, event_type: str, envelope: dict) -> RealtimeEnvelope:
    raw_occurred_at = envelope.get("occurred_at")
    occurred_at = datetime.now(timezone.utc)
    if isinstance(raw_occurred_at, str):
        try:
            occurred_at = datetime.fromisoformat(raw_occurred_at.replace("Z", "+00:00"))
        except ValueError:
            pass
    payload = envelope.get("payload", {})
    dedupe_key = payload.get("dedupe_key") if isinstance(payload, dict) else None
    return RealtimeEnvelope(
        channel=channel,
        event_type=event_type,
        occurred_at=occurred_at,
        correlation_id=envelope.get("correlation_id"),
        dedupe_key=dedupe_key if isinstance(dedupe_key, str) else None,
        payload=payload if isinstance(payload, dict) else {},
        metadata={"message_id": envelope.get("message_id"), "producer": envelope.get("producer")},
    )


def _seed_admin_user_if_configured(container: Container) -> None:
    username = container.settings.auth_seed_admin_username
    password = container.settings.auth_seed_admin_password
    if not username or not password:
        return
    with container.session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        if repo.get_by_username(username) is None:
            repo.create_user(
                username=username,
                password_hash=hash_password(password, container.settings.auth_bcrypt_rounds),
                is_active=True,
            )
            session.commit()
            logger.info("Seeded admin account username=%s", username)


async def _run_media_cleanup_scheduler(container: Container) -> None:
    interval_days = max(1, container.settings.media_cleanup_interval_days)
    interval_seconds = interval_days * 24 * 60 * 60
    batch_size = max(1, container.settings.media_cleanup_batch_size)

    while True:
        try:
            with container.session_factory() as session:
                use_case = container.build_cleanup_media_assets_use_case(session)
                result = use_case.execute(CleanupMediaAssetsCommand(max_batch_size=batch_size))
                session.commit()
                logger.info(
                    "media cleanup completed deleted_total=%s details=%s",
                    result.deleted_total,
                    result.deleted_by_asset_type,
                )
        except Exception:
            logger.exception("media cleanup job failed")

        await asyncio.sleep(interval_seconds)

