from app.core.config import Settings


def test_settings_builds_database_url_from_parts() -> None:
    settings = Settings(
        POSTGRES_HOST="localhost",
        POSTGRES_PORT=5432,
        POSTGRES_DB="attendance",
        POSTGRES_USER="attendance",
        POSTGRES_PASSWORD="attendance",
    )

    assert settings.sqlalchemy_database_url.startswith("postgresql+psycopg://attendance:attendance@localhost:5432/")


def test_settings_prefers_explicit_database_url() -> None:
    settings = Settings(DATABASE_URL="sqlite+pysqlite:///:memory:")
    assert settings.sqlalchemy_database_url == "sqlite+pysqlite:///:memory:"
