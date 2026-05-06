from __future__ import annotations


def test_health_endpoints(api_client):
    live = api_client.get("/health/live")
    assert live.status_code == 200
    assert live.json() == {"status": "ok"}

    ready = api_client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready"}
