"""Backend service entrypoint."""

from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.bootstrap.container import build_container
from app.bootstrap.logging import configure_logging
from app.core.db import ping_database
from app.core.exceptions import AppError, InfrastructureError
from app.application.use_cases.event_ingestion import IngestStatus
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer
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

    if container.settings.enable_event_consumer:
        consumer = RedisEventConsumer(container.settings)
        consumer.register_handler("recognition_event.detected", _build_recognition_ingest_handler(container))
        consumer.register_handler("unknown_event.detected", _build_unknown_ingest_handler(container))
        consumer.register_handler("spoof_alert.detected", _build_spoof_ingest_handler(container))
        await consumer.start()
        app.state.redis_consumer = consumer

    logger.info("Backend service started")
    try:
        yield
    finally:
        consumer: RedisEventConsumer | None = app.state.redis_consumer
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
            logger.info(
                "ingest spoof result=%s message_id=%s dedupe_key=%s",
                result.status,
                envelope.get("message_id"),
                (envelope.get("payload") or {}).get("dedupe_key"),
            )
            return result.status in {IngestStatus.PROCESSED, IngestStatus.DUPLICATE, IngestStatus.IGNORED}

    return _handler

