"""Authentication API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.application.use_cases.auth import (
    LoginCommand,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
    RefreshCommand,
)
from app.core.dependencies import (
    get_admin_user,
    get_login_use_case,
    get_logout_use_case,
    get_refresh_access_token_use_case,
)
from app.domain.auth.entities import User
from app.presentation.schemas.auth import (
    AuthTokenResponse,
    CurrentUserResponse,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthTokenResponse)
def login(
    payload: LoginRequest,
    use_case: LoginUseCase = Depends(get_login_use_case),
) -> AuthTokenResponse:
    result = use_case.execute(LoginCommand(username=payload.username, password=payload.password))
    return AuthTokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        token_type=result.token_type,
        expires_in=result.expires_in,
    )


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh_token(
    payload: RefreshTokenRequest,
    use_case: RefreshAccessTokenUseCase = Depends(get_refresh_access_token_use_case),
) -> AuthTokenResponse:
    result = use_case.execute(RefreshCommand(refresh_token=payload.refresh_token))
    return AuthTokenResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        token_type=result.token_type,
        expires_in=result.expires_in,
    )


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    _admin: User = Depends(get_admin_user),
    use_case: LogoutUseCase = Depends(get_logout_use_case),
) -> dict[str, str]:
    use_case.execute(payload.refresh_token)
    return {"status": "ok"}


@router.get("/me", response_model=CurrentUserResponse)
def me(
    admin_user: User = Depends(get_admin_user),
) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=admin_user.id,
        username=admin_user.username,
        is_active=admin_user.is_active,
        last_login_at=admin_user.last_login_at,
    )
