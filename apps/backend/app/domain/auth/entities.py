"""Authentication domain entities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True, kw_only=True)
class User:
    id: UUID
    username: str
    password_hash: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True, kw_only=True)
class RefreshTokenRecord:
    id: UUID
    user_id: UUID
    token_hash: str
    expires_at: datetime
    revoked_at: datetime | None
    created_at: datetime
    last_used_at: datetime | None
