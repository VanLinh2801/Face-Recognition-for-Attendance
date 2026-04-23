"""Shared application exceptions."""

from __future__ import annotations


class AppError(Exception):
    """Base error with transport-safe error code."""

    def __init__(self, message: str, *, code: str = "app_error", details: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", *, details: dict[str, str] | None = None) -> None:
        super().__init__(message, code="not_found", details=details)


class ValidationError(AppError):
    def __init__(self, message: str = "Invalid request", *, details: dict[str, str] | None = None) -> None:
        super().__init__(message, code="validation_error", details=details)


class InfrastructureError(AppError):
    def __init__(self, message: str = "Infrastructure failure", *, details: dict[str, str] | None = None) -> None:
        super().__init__(message, code="infrastructure_error", details=details)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict", *, details: dict[str, str] | None = None) -> None:
        super().__init__(message, code="conflict", details=details)
