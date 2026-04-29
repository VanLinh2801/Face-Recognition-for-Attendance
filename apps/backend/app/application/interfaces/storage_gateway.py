"""Object storage gateway abstraction."""

from __future__ import annotations

from typing import Protocol


class ObjectStorageGateway(Protocol):
    def delete_object(self, *, bucket_name: str, object_key: str) -> None: ...
"""Storage gateway abstraction."""
