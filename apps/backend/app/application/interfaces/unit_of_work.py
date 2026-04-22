"""Unit of work abstraction."""

from __future__ import annotations

from typing import Protocol


class UnitOfWork(Protocol):
    """Application-level transaction boundary."""

    def __enter__(self) -> "UnitOfWork": ...

    def __exit__(self, exc_type, exc_val, exc_tb) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...
