"""Refresh token repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.auth.entities import RefreshTokenRecord


class RefreshTokenRepository(Protocol):
    def create(
        self,
        *,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshTokenRecord: ...

    def get_by_hash(self, token_hash: str) -> RefreshTokenRecord | None: ...

    def revoke(self, token_hash: str, revoked_at: datetime) -> bool: ...

    def touch_last_used(self, token_hash: str, used_at: datetime) -> None: ...
