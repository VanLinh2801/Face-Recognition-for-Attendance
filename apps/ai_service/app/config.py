"""Configuration for the AI service worker."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_input_stream: str = os.getenv(
        "REDIS_INPUT_STREAM", "stream:vision:frames_to_process"
    )
    redis_output_stream: str = os.getenv(
        "REDIS_OUTPUT_STREAM", "stream:vision:access_events"
    )
    redis_consumer_group_ai: str = os.getenv(
        "REDIS_CONSUMER_GROUP_AI", "ai_service_group"
    )
    redis_consumer_name: str = os.getenv("REDIS_CONSUMER_NAME", "ai-worker-1")
    redis_block_ms: int = int(os.getenv("REDIS_BLOCK_MS", "5000"))

    qdrant_host: str = os.getenv("QDRANT_HOST", "localhost")
    qdrant_port: int = int(os.getenv("QDRANT_PORT", "6333"))
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION", "face_vectors")
    qdrant_match_threshold: float = float(os.getenv("QDRANT_MATCH_THRESHOLD", "0.82"))
    embedding_size: int = int(os.getenv("EMBEDDING_SIZE", "32"))

    min_image_size: int = int(os.getenv("MIN_IMAGE_SIZE", "128"))
    min_face_size: int = int(os.getenv("MIN_FACE_SIZE", "96"))
    image_fetch_timeout_seconds: int = int(
        os.getenv("IMAGE_FETCH_TIMEOUT_SECONDS", "10")
    )
    run_once: bool = _get_bool("AI_SERVICE_RUN_ONCE", False)
