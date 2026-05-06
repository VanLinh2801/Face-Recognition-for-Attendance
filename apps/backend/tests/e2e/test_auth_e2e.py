from __future__ import annotations


def test_admin_login_and_me(api_client, admin_headers, admin_tokens, e2e_settings):
    assert admin_tokens["access_token"]
    assert admin_tokens["refresh_token"]

    me = api_client.get("/api/v1/auth/me", headers=admin_headers)
    assert me.status_code == 200
    assert me.json()["username"] == e2e_settings.admin_username
