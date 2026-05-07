from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_STREAM_PIPELINE_AI: str = "pipeline_ai"
    REDIS_STREAM_AI_BACKEND: str = "ai_backend"
    REDIS_CONSUMER_GROUP: str = "ai_service_group"
    REDIS_CONSUMER_NAME: str = "ai_service_1"

    # ── Qdrant ─────────────────────────────────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "person_faces"
    QDRANT_VECTOR_SIZE: int = 512

    # ── MinIO ──────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False

    # ── AI Models ──────────────────────────────────────────────────────────
    INSIGHTFACE_MODEL_NAME: str = "buffalo_l"
    INSIGHTFACE_MODEL_VERSION: str = "1.0"
    INSIGHTFACE_MODEL_DIR: str = "/app/models/insightface"
    INSIGHTFACE_CTX_ID: int = 0
    INSIGHTFACE_DET_SIZE: int = 640

    ANTI_SPOOF_MODEL_PATH: str = "/app/models/anti_spoof/minifasnet.onnx"
    ONNX_EXECUTION_PROVIDER: str = "CPUExecutionProvider"
    ANTI_SPOOF_INPUT_SIZE: int = 80
    ANTI_SPOOF_MEAN: str = "0.5,0.5,0.5"
    ANTI_SPOOF_STD: str = "0.5,0.5,0.5"
    ANTI_SPOOF_REAL_CLASS_INDEX: int = 1

    # ── Thresholds (env-configurable, do NOT hardcode in logic) ───────────
    # Cosine similarity >= RECOGNITION_THRESHOLD → known person
    RECOGNITION_THRESHOLD: float = 0.45
    # Real-face score >= SPOOF_THRESHOLD → pass anti-spoof (lower = spoof)
    SPOOF_THRESHOLD: float = 0.70

    # ── Misc ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    QDRANT_TOP_K: int = 1

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
