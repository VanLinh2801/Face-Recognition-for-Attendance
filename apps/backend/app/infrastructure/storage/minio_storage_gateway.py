"""MinIO storage gateway implementation."""

from __future__ import annotations

from io import BytesIO

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

    def download_bytes(self, *, bucket_name: str, object_key: str) -> bytes:
        response = self._client.get_object(bucket_name, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def upload_bytes(
        self,
        *,
        bucket_name: str,
        object_key: str,
        content: bytes,
        content_type: str,
    ) -> None:
        if not self._client.bucket_exists(bucket_name):
            self._client.make_bucket(bucket_name)
        self._client.put_object(
            bucket_name,
            object_key,
            BytesIO(content),
            length=len(content),
            content_type=content_type,
        )

    def delete_object(self, *, bucket_name: str, object_key: str) -> None:
        try:
            self._client.remove_object(bucket_name, object_key)
        except S3Error as exc:
            if exc.code == "NoSuchKey":
                return
            raise
