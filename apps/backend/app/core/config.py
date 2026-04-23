"""Application configuration and settings loading."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: str = Field(default="local", alias="ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")

    postgres_host: str = Field(default="postgres", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="attendance", alias="POSTGRES_DB")
    postgres_user: str = Field(default="attendance", alias="POSTGRES_USER")
    postgres_password: str = Field(default="attendance", alias="POSTGRES_PASSWORD")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    redis_stream_ai_events: str = Field(default="ai.backend.events", alias="REDIS_STREAM_AI_EVENTS")
    redis_stream_backend_pipeline: str = Field(
        default="backend.pipeline.events",
        alias="REDIS_STREAM_BACKEND_PIPELINE",
    )
    redis_consumer_group: str = Field(default="backend-consumers", alias="REDIS_CONSUMER_GROUP")
    redis_consumer_name: str = Field(default="backend-1", alias="REDIS_CONSUMER_NAME")
    redis_block_ms: int = Field(default=5000, alias="REDIS_BLOCK_MS")
    redis_batch_size: int = Field(default=20, alias="REDIS_BATCH_SIZE")
    enable_event_consumer: bool = Field(default=True, alias="ENABLE_EVENT_CONSUMER")

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
