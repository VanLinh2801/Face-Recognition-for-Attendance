from __future__ import annotations

from pathlib import Path

import pytest


UNIT_EVENT_FILES = {
    "test_contract_validator.py",
    "test_redis_consumer.py",
    "test_event_handlers.py",
    "test_event_ingestion_use_cases.py",
    "test_realtime_catchup_use_case.py",
    "test_realtime_ingestion_emit.py",
}

INTEGRATION_REALTIME_FILES = {
    "test_realtime_websocket.py",
    "test_realtime_catchup_api.py",
    "test_event_flow_scenarios.py",
}


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        path = Path(str(item.fspath))
        if "tests" not in path.parts:
            continue
        if "unit" in path.parts:
            marker = "unit_events" if path.name in UNIT_EVENT_FILES else "unit_core"
            item.add_marker(getattr(pytest.mark, marker))
            continue
        if "e2e" in path.parts:
            item.add_marker(pytest.mark.e2e)
            continue
        if "integration" in path.parts:
            marker = "integration_realtime" if path.name in INTEGRATION_REALTIME_FILES else "integration_api"
            item.add_marker(getattr(pytest.mark, marker))
