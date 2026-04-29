"""MinIO storage gateway implementation."""

from __future__ import annotations

from minio import Minio
from minio.error import S3Error

from app.core.config import Settings


class MinioStorageGateway:
    def __init__(self, settings: Settings) -> None:
        self._client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )

    def delete_object(self, *, bucket_name: str, object_key: str) -> None:
        try:
            self._client.remove_object(bucket_name, object_key)
        except S3Error as exc:
            if exc.code == "NoSuchKey":
                return
            raise
