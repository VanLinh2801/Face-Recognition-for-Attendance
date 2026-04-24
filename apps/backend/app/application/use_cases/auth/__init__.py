"""Authentication use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.application.interfaces.repositories.refresh_token_repository import RefreshTokenRepository
from app.application.interfaces.repositories.user_repository import UserRepository
from app.core.config import Settings
from app.core.exceptions import ValidationError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    verify_password,
    verify_jwt_token,
)
from app.domain.auth.entities import User


@dataclass(slots=True, kw_only=True)
class LoginCommand:
    username: str
    password: str


@dataclass(slots=True, kw_only=True)
class LoginResult:
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 900


@dataclass(slots=True, kw_only=True)
class RefreshCommand:
    refresh_token: str


class LoginUseCase:
    def __init__(
        self,
        *,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
        settings: Settings,
    ) -> None:
        self._user_repository = user_repository
        self._refresh_token_repository = refresh_token_repository
        self._settings = settings

    def execute(self, command: LoginCommand) -> LoginResult:
        user = self._user_repository.get_by_username(command.username)
        if user is None or not user.is_active:
            raise ValidationError("Invalid credentials")
        if not verify_password(command.password, user.password_hash):
            raise ValidationError("Invalid credentials")
        now = datetime.now(timezone.utc)
        self._user_repository.update_last_login(user.id, now)
        access_token = create_access_token(
            subject=str(user.id),
            settings=self._settings,
            extra_claims={"username": user.username},
        )
        refresh_token = generate_refresh_token()
        refresh_token_hash = hash_refresh_token(refresh_token)
        self._refresh_token_repository.create(
            user_id=user.id,
            token_hash=refresh_token_hash,
            expires_at=now + timedelta(seconds=self._settings.jwt_refresh_expires_seconds),
        )
        return LoginResult(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self._settings.jwt_access_expires_seconds,
        )


class RefreshAccessTokenUseCase:
    def __init__(
        self,
        *,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
        settings: Settings,
    ) -> None:
        self._user_repository = user_repository
        self._refresh_token_repository = refresh_token_repository
        self._settings = settings

    def execute(self, command: RefreshCommand) -> LoginResult:
        now = datetime.now(timezone.utc)
        token_hash = hash_refresh_token(command.refresh_token)
        token_record = self._refresh_token_repository.get_by_hash(token_hash)
        if token_record is None or token_record.revoked_at is not None or token_record.expires_at <= now:
            raise ValidationError("Invalid refresh token")
        user = self._user_repository.get_by_id(token_record.user_id)
        if user is None or not user.is_active:
            raise ValidationError("Invalid refresh token")
        self._refresh_token_repository.touch_last_used(token_hash, now)
        access_token = create_access_token(
            subject=str(user.id),
            settings=self._settings,
            extra_claims={"username": user.username},
        )
        return LoginResult(
            access_token=access_token,
            refresh_token=command.refresh_token,
            expires_in=self._settings.jwt_access_expires_seconds,
        )


class LogoutUseCase:
    def __init__(self, refresh_token_repository: RefreshTokenRepository) -> None:
        self._refresh_token_repository = refresh_token_repository

    def execute(self, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        self._refresh_token_repository.revoke(token_hash, datetime.now(timezone.utc))


class GetCurrentUserUseCase:
    def __init__(self, user_repository: UserRepository, settings: Settings) -> None:
        self._user_repository = user_repository
        self._settings = settings

    def execute(self, access_token: str) -> User:
        principal = verify_jwt_token(access_token, self._settings)
        try:
            user_id = UUID(principal.subject)
        except ValueError as exc:
            raise ValidationError("Invalid access token subject") from exc
        user = self._user_repository.get_by_id(user_id)
        if user is None or not user.is_active:
            raise ValidationError("User not found")
        return user
