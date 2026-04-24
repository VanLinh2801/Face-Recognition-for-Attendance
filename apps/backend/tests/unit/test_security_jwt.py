from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest

from app.core.config import Settings
from app.core.security import extract_bearer_token, verify_jwt_token


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _build_hs256_token(secret: str, payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_part = _b64url(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def test_verify_jwt_token_success() -> None:
    settings = Settings(
        JWT_SECRET_KEY="secret",
        JWT_ISSUER="issuer",
        JWT_AUDIENCE="aud",
        ENABLE_EVENT_CONSUMER=False,
    )
    payload = {"sub": "user-1", "iss": "issuer", "aud": "aud", "exp": int(time.time()) + 60}
    token = _build_hs256_token("secret", payload)
    principal = verify_jwt_token(token, settings)
    assert principal.subject == "user-1"
    assert principal.claims["iss"] == "issuer"


def test_verify_jwt_token_expired() -> None:
    settings = Settings(
        JWT_SECRET_KEY="secret",
        JWT_ISSUER="issuer",
        JWT_AUDIENCE="aud",
        ENABLE_EVENT_CONSUMER=False,
    )
    payload = {"sub": "user-1", "iss": "issuer", "aud": "aud", "exp": int(time.time()) - 1}
    token = _build_hs256_token("secret", payload)
    with pytest.raises(Exception):
        verify_jwt_token(token, settings)


def test_extract_bearer_token() -> None:
    assert extract_bearer_token("Bearer abc", None) == "abc"
    assert extract_bearer_token(None, "qtoken") == "qtoken"
