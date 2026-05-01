"""
AI Service entry point.

Startup sequence:
    1. Connect Redis publisher
    2. Connect Redis consumer + create consumer group
    3. Ensure Qdrant collection exists
    4. Start FastAPI (health endpoint only)
    5. Launch Redis consumer loop as background task

Shutdown sequence (SIGTERM / SIGINT):
    1. Stop consumer loop
    2. Close Redis connections
"""
import asyncio
import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.bootstrap.container import Container
from app.core.config import settings

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

container = Container()


def _route_pipeline_ai_event(event: dict):
    """Route incoming pipeline_ai events to the correct handler by event_name."""
    event_name = event.get("event_name", "")
    if event_name == "recognition.requested":
        return container.recognition_handler.handle(event)
    elif event_name == "registration.requested":
        return container.registration_handler.handle(event)
    else:
        logger.warning("Unhandled event_name='%s' — skipping", event_name)
        return asyncio.sleep(0)  # no-op coroutine


async def _consumer_task() -> None:
    """Background task: consume pipeline_ai stream forever."""
    async def dispatch(event: dict) -> None:
        await _route_pipeline_ai_event(event)

    await container.pipeline_ai_consumer.consume(dispatch)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info("AI Service starting up …")

    await container.publisher.connect()
    await container.pipeline_ai_consumer.connect()
    await container.vector_store.ensure_collection()

    consumer_task = asyncio.create_task(_consumer_task(), name="pipeline_ai_consumer")
    logger.info("AI Service ready — consuming stream '%s'", settings.REDIS_STREAM_PIPELINE_AI)

    yield  # application runs here

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("AI Service shutting down …")
    await container.pipeline_ai_consumer.stop()
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await container.publisher.close()
    logger.info("AI Service shutdown complete")


app = FastAPI(
    title="AI Service",
    description="Face embedding, anti-spoofing, and vector search microservice.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["infra"])
async def health() -> dict:
    """Liveness probe for Docker / orchestrator."""
    return {"status": "ok", "service": "ai_service"}
