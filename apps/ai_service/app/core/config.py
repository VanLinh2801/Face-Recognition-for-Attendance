"""Configuration for the AI service worker."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ENV_PATH, override=False)


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ModelSettings:
    detector: str = os.getenv("FACE_DETECTOR_MODEL", "scrfd_2.5g")
    spoof: str = os.getenv("FACE_SPOOF_MODEL", "miniFASNet")
    recognizer: str = os.getenv("FACE_RECOGNIZER_MODEL", "antelopev2")


@dataclass(frozen=True)
class BenchmarkSettings:
    gallery_dir: str = os.getenv(
        "BENCHMARK_GALLERY_DIR",
        "data/benchmarks/recognizer_compare/gallery",
    )
    probe_dir: str = os.getenv(
        "BENCHMARK_PROBE_DIR",
        "data/benchmarks/recognizer_compare/probe",
    )
    report_dir: str = os.getenv(
        "BENCHMARK_REPORT_DIR",
        "data/benchmarks/recognizer_compare/reports",
    )
    models: tuple[str, ...] = tuple(
        part.strip()
        for part in os.getenv(
            "BENCHMARK_RECOGNIZER_MODELS",
            "antelopev2,buffalo_l",
        ).split(",")
        if part.strip()
    )
    match_threshold: float = float(
        os.getenv("BENCHMARK_MATCH_THRESHOLD", os.getenv("QDRANT_MATCH_THRESHOLD", "0.82"))
    )
    insightface_ctx_id: int = int(os.getenv("INSIGHTFACE_CTX_ID", "-1"))
    insightface_det_size: int = int(os.getenv("INSIGHTFACE_DET_SIZE", "640"))


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
    models: ModelSettings = ModelSettings()
    benchmark: BenchmarkSettings = BenchmarkSettings()
