"""Pagination DTOs for query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(slots=True, kw_only=True)
class PageQuery:
    page: int = 1
    page_size: int = 20


@dataclass(slots=True, kw_only=True)
class PageResult(Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
