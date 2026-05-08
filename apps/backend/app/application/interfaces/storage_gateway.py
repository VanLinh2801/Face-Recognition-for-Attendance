"""Object storage gateway abstraction."""

from __future__ import annotations

from typing import Protocol


class ObjectStorageGateway(Protocol):
    def download_bytes(self, *, bucket_name: str, object_key: str) -> bytes: ...

    def upload_bytes(
        self,
        *,
        bucket_name: str,
        object_key: str,
        content: bytes,
        content_type: str,
    ) -> None: ...

    def delete_object(self, *, bucket_name: str, object_key: str) -> None: ...
"""Storage gateway abstraction."""
