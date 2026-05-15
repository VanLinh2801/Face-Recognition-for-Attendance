from minio import Minio
from app.core.config import settings
from app.utils.logger import logger
from app.utils.metrics_collector import metrics_collector
from typing import Optional
import io
import time

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

    def upload_image(
        self,
        object_key: str,
        content: bytes,
        content_type: str = "image/jpeg",
        bucket_name: Optional[str] = None,
    ):
        bucket = bucket_name or settings.MINIO_BUCKET_NAME
        start_time = time.perf_counter()
        try:
            data = io.BytesIO(content)
            self.client.put_object(
                bucket,
                object_key,
                data,
                len(content),
                content_type=content_type
            )
            end_time = time.perf_counter()
            upload_latency_ms = (end_time - start_time) * 1000
            metrics_collector.record_upload_complete(upload_latency_ms)
            logger.info(f"[MINIO] ✓ Uploaded {len(content)//1024}KB → {object_key} ({upload_latency_ms:.2f}ms)")
            return True
        except Exception as e:
            logger.error(f"[MINIO] ✗ Upload failed: {e}")
            return False

    def download_image(self, object_key: str, bucket_name: Optional[str] = None) -> Optional[bytes]:
        bucket = bucket_name or settings.MINIO_BUCKET_NAME
        try:
            response = self.client.get_object(bucket, object_key)
            return response.read()
        except Exception as e:
            logger.error(f"Error downloading from MinIO: {e}")
            return None

storage_client = StorageClient()
