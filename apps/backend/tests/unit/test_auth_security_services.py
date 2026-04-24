from __future__ import annotations

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_jwt_token,
    verify_password,
)


def test_password_hash_and_verify() -> None:
    hashed = hash_password("secret", 4)
    assert verify_password("secret", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_issue_and_verify() -> None:
    settings = Settings(
        JWT_SECRET_KEY="secret",
        JWT_ISSUER="issuer",
        JWT_AUDIENCE="aud",
        JWT_ACCESS_EXPIRES_SECONDS=60,
        ENABLE_EVENT_CONSUMER=False,
    )
    token = create_access_token(subject="abc", settings=settings, extra_claims={"username": "admin"})
    principal = verify_jwt_token(token, settings)
    assert principal.subject == "abc"
    assert principal.claims["username"] == "admin"


def test_refresh_token_generation_and_hash() -> None:
    token = generate_refresh_token()
    assert token
    assert hash_refresh_token(token) != token
