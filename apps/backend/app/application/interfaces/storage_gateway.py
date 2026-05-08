"""Object storage gateway abstraction."""

from __future__ import annotations

from datetime import timedelta
from typing import BinaryIO
from typing import Protocol


class ObjectStorageGateway(Protocol):
    def put_object(
        self,
        *,
        bucket_name: str,
        object_key: str,
        data: BinaryIO,
        length: int,
        content_type: str,
    ) -> None: ...

    def delete_object(self, *, bucket_name: str, object_key: str) -> None: ...
    def presigned_get_object_url(self, *, bucket_name: str, object_key: str, expires_in: timedelta) -> str: ...
