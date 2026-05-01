import asyncio
import io
import logging

from minio import Minio

from app.core.config import settings

logger = logging.getLogger(__name__)


class MinioImageClient:
    """
    Downloads raw image bytes from MinIO object storage.
    The sync Minio client is wrapped in run_in_executor to keep asyncio clean.
    """

    def __init__(self) -> None:
        self._client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )

    async def download(self, bucket_name: str, object_key: str) -> bytes:
        loop = asyncio.get_running_loop()

        def _get() -> bytes:
            response = self._client.get_object(bucket_name, object_key)
            data = response.read()
            response.close()
            response.release_conn()
            return data

        logger.debug("Downloading MinIO object bucket=%s key=%s", bucket_name, object_key)
        return await loop.run_in_executor(None, _get)
