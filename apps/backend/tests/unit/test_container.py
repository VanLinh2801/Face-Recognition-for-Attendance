from app.bootstrap.container import build_container
from app.core.config import Settings


def test_build_container_initializes_core_dependencies() -> None:
    settings = Settings(
        DATABASE_URL="sqlite+pysqlite:///:memory:",
        ENABLE_EVENT_CONSUMER=False,
    )

    container = build_container(settings)

    assert container.settings.enable_event_consumer is False
    assert container.engine is not None
    assert container.session_factory is not None
    assert container.session_provider is not None
