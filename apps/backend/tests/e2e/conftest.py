from __future__ import annotations

import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
import pytest
from redis import Redis


@dataclass(slots=True)
class E2ESettings:
    base_url: str
    redis_url: str
    ai_stream: str
    pipeline_stream: str
    admin_username: str
    admin_password: str


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    enabled = config.getoption("--run-e2e") or os.getenv("BACKEND_E2E_ENABLED") == "1"
    if enabled:
        return
    skip_marker = pytest.mark.skip(reason="set BACKEND_E2E_ENABLED=1 or pass --run-e2e to run e2e tests")
    for item in items:
        if "e2e" in str(item.fspath):
            item.add_marker(skip_marker)


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--run-e2e", action="store_true", default=False, help="Run Docker-backed end-to-end tests")


@pytest.fixture(scope="session")
def e2e_settings() -> E2ESettings:
    return E2ESettings(
        base_url=os.getenv("BACKEND_E2E_BASE_URL", "http://127.0.0.1:8000"),
        redis_url=os.getenv("BACKEND_E2E_REDIS_URL", "redis://127.0.0.1:6379/0"),
        ai_stream=os.getenv("BACKEND_E2E_AI_STREAM", "ai.backend.events"),
        pipeline_stream=os.getenv("BACKEND_E2E_PIPELINE_STREAM", "pipeline.backend.events"),
        admin_username=os.getenv("BACKEND_E2E_ADMIN_USERNAME", "admin"),
        admin_password=os.getenv("BACKEND_E2E_ADMIN_PASSWORD", "secret"),
    )


@pytest.fixture(scope="session")
def api_client(e2e_settings: E2ESettings) -> httpx.Client:
    with httpx.Client(base_url=e2e_settings.base_url, timeout=10.0) as client:
        yield client


@pytest.fixture(scope="session")
def redis_client(e2e_settings: E2ESettings) -> Redis:
    client = Redis.from_url(e2e_settings.redis_url, decode_responses=True)
    yield client
    client.close()


@pytest.fixture(scope="session")
def admin_tokens(api_client: httpx.Client, e2e_settings: E2ESettings) -> dict[str, str]:
    response = api_client.post(
        "/api/v1/auth/login",
        json={"username": e2e_settings.admin_username, "password": e2e_settings.admin_password},
    )
    response.raise_for_status()
    return response.json()


@pytest.fixture
def admin_headers(admin_tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_tokens['access_token']}"}


@pytest.fixture
def publish_event(redis_client: Redis):
    def _publish(*, stream: str, envelope: dict[str, Any]) -> str:
        return str(redis_client.xadd(stream, {"envelope": json.dumps(envelope)}))

    return _publish


@pytest.fixture
def wait_until() -> Callable[[Callable[[], Any], float, float], Any]:
    def _wait_until(callback: Callable[[], Any], timeout: float = 10.0, interval: float = 0.25) -> Any:
        deadline = time.time() + timeout
        last_error: Exception | None = None
        while time.time() < deadline:
            try:
                result = callback()
                if result:
                    return result
            except Exception as exc:  # noqa: BLE001 - helper for polling infra-backed flows
                last_error = exc
            time.sleep(interval)
        if last_error is not None:
            raise last_error
        raise AssertionError("Condition was not satisfied before timeout")

    return _wait_until


@pytest.fixture
def websocket_reader(e2e_settings: E2ESettings):
    connections: list[Any] = []

    def _connect(token: str, channels: str):
        from websocket import create_connection

        ws_base_url = e2e_settings.base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws = create_connection(
            f"{ws_base_url}/api/ws/v1/realtime?token={token}&channels={channels}",
            timeout=10,
            http_proxy_host=None,
            http_proxy_port=None,
            http_no_proxy=["backend", "127.0.0.1", "localhost"],
        )
        connections.append(ws)
        return ws

    yield _connect

    for ws in connections:
        try:
            ws.close()
        except Exception:  # noqa: BLE001 - best effort cleanup for websocket clients
            pass
