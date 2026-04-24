"""Security primitives for JWT authentication."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.core.exceptions import ValidationError


@dataclass(slots=True, kw_only=True)
class AuthenticatedPrincipal:
    subject: str
    claims: dict[str, Any]


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _decode_json_part(value: str) -> dict[str, Any]:
    try:
        return json.loads(_b64url_decode(value))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValidationError("Invalid JWT payload") from exc


def _verify_hs256(jwt_token: str, secret_key: str) -> dict[str, Any]:
    parts = jwt_token.split(".")
    if len(parts) != 3:
        raise ValidationError("Invalid JWT format")
    header_part, payload_part, signature_part = parts
    signing_input = f"{header_part}.{payload_part}".encode("utf-8")
    expected_signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_signature_part = _b64url_encode(expected_signature)
    if not hmac.compare_digest(expected_signature_part, signature_part):
        raise ValidationError("Invalid JWT signature")
    return _decode_json_part(payload_part)


def _validate_registered_claims(payload: dict[str, Any], settings: Settings) -> None:
    issuer = payload.get("iss")
    if issuer != settings.jwt_issuer:
        raise ValidationError("Invalid JWT issuer")
    audience = payload.get("aud")
    if isinstance(audience, str):
        audiences = {audience}
    elif isinstance(audience, list):
        audiences = {str(item) for item in audience}
    else:
        audiences = set()
    if settings.jwt_audience not in audiences:
        raise ValidationError("Invalid JWT audience")
    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise ValidationError("Invalid JWT expiration")
    if exp < int(time.time()):
        raise ValidationError("JWT expired")


def verify_jwt_token(jwt_token: str, settings: Settings) -> AuthenticatedPrincipal:
    if settings.jwt_algorithm != "HS256":
        raise ValidationError("Unsupported JWT algorithm")
    payload = _verify_hs256(jwt_token, settings.jwt_secret_key)
    _validate_registered_claims(payload, settings)
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise ValidationError("Invalid JWT subject")
    return AuthenticatedPrincipal(subject=subject, claims=payload)


def extract_bearer_token(authorization_header: str | None, query_token: str | None = None) -> str:
    if authorization_header:
        parts = authorization_header.strip().split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1]:
            return parts[1]
    if query_token:
        return query_token
    raise ValidationError("Missing bearer token")
