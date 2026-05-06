"""Helpers for mapping StrEnum values to PostgreSQL enums."""

from __future__ import annotations

from enum import Enum

from sqlalchemy import Enum as SQLEnum


def pg_enum(enum_cls: type[Enum], *, name: str) -> SQLEnum:
    return SQLEnum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
        native_enum=True,
        validate_strings=True,
    )
