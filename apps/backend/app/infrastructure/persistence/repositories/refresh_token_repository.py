"""SQLAlchemy refresh token repository."""

from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.refresh_token_repository import RefreshTokenRepository
from app.domain.auth.entities import RefreshTokenRecord
from app.infrastructure.persistence.models.auth_refresh_token_model import AuthRefreshTokenModel


def _to_domain(item: AuthRefreshTokenModel) -> RefreshTokenRecord:
    return RefreshTokenRecord(
        id=item.id,
        user_id=item.user_id,
        token_hash=item.token_hash,
        expires_at=item.expires_at,
        revoked_at=item.revoked_at,
        created_at=item.created_at,
        last_used_at=item.last_used_at,
    )


class SqlAlchemyRefreshTokenRepository(RefreshTokenRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, *, user_id, token_hash: str, expires_at: datetime) -> RefreshTokenRecord:
        item = AuthRefreshTokenModel(
            id=uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=None,
            created_at=datetime.now(timezone.utc),
            last_used_at=None,
        )
        self._session.add(item)
        self._session.flush()
        return _to_domain(item)

    def get_by_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        stmt = select(AuthRefreshTokenModel).where(AuthRefreshTokenModel.token_hash == token_hash)
        item = self._session.execute(stmt).scalar_one_or_none()
        return _to_domain(item) if item else None

    def revoke(self, token_hash: str, revoked_at: datetime) -> bool:
        stmt = select(AuthRefreshTokenModel).where(AuthRefreshTokenModel.token_hash == token_hash)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return False
        item.revoked_at = revoked_at
        self._session.flush()
        return True

    def touch_last_used(self, token_hash: str, used_at: datetime) -> None:
        stmt = select(AuthRefreshTokenModel).where(AuthRefreshTokenModel.token_hash == token_hash)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return
        item.last_used_at = used_at
        self._session.flush()
