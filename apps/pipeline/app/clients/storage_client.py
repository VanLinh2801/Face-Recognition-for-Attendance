from minio import Minio
from app.core.config import settings
from app.utils.logger import logger
from typing import Optional
import io

class StorageClient:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET_NAME):
                self.client.make_bucket(settings.MINIO_BUCKET_NAME)
                logger.info(f"Created bucket: {settings.MINIO_BUCKET_NAME}")
        except Exception as e:
            logger.error(f"Error checking/creating bucket: {e}")

    def upload_image(self, object_key: str, content: bytes, content_type: str = "image/jpeg"):
        try:
            data = io.BytesIO(content)
            self.client.put_object(
                settings.MINIO_BUCKET_NAME,
                object_key,
                data,
                len(content),
                content_type=content_type
            )
            return True
        except Exception as e:
            logger.error(f"Error uploading to MinIO: {e}")
            return False

    def download_image(self, object_key: str) -> Optional[bytes]:
        try:
            response = self.client.get_object(settings.MINIO_BUCKET_NAME, object_key)
            return response.read()
        except Exception as e:
            logger.error(f"Error downloading from MinIO: {e}")
            return None

storage_client = StorageClient()
