import logging
import uuid
from typing import Any

from app.application.use_cases.register_face import RegisterFaceUseCase
from app.core.config import settings
from app.domain.entities.face import FaceInput
from app.infrastructure.integration.minio_client import MinioImageClient
from app.infrastructure.integration.redis_publisher import RedisStreamPublisher

logger = logging.getLogger(__name__)


class RegistrationRequestedHandler:
    """
    Handles `registration.requested` events consumed from the pipeline_ai Redis Stream.

    Flow:
        1. Download prepared face crop from MinIO
        2. Run RegisterFaceUseCase (embed + upsert Qdrant)
        3. Publish `registration_processing.completed` to ai_backend stream
           - status="indexed" on success
           - status="failed" on any error
    """

    def __init__(
        self,
        use_case: RegisterFaceUseCase,
        minio_client: MinioImageClient,
        publisher: RedisStreamPublisher,
    ) -> None:
        self._use_case = use_case
        self._minio = minio_client
        self._publisher = publisher

    async def handle(self, event: dict) -> None:
        payload = event.get("payload", {})
        correlation_id = event.get("correlation_id") or str(uuid.uuid4())

        person_id = payload.get("person_id")
        registration_id = payload.get("registration_id")
        media_asset = payload.get("face_media_asset")
        source_media_asset_id = payload.get("source_media_asset_id")

        try:
            person_id = self._require_text(payload, "person_id")
            registration_id = self._require_text(payload, "registration_id")
            media_asset = self._validate_face_media_asset(media_asset)

            logger.info(
                "registration.requested person_id=%s registration_id=%s face_object=%s",
                person_id,
                registration_id,
                media_asset["object_key"],
            )

            try:
                image_bytes = await self._minio.download(
                    bucket_name=media_asset["bucket_name"],
                    object_key=media_asset["object_key"],
                )
            except Exception as exc:
                raise RegistrationProcessingError(
                    "FACE_IMAGE_DOWNLOAD_FAILED",
                    (
                        "Could not download face_media_asset "
                        f"{media_asset['bucket_name']}/{media_asset['object_key']}: {exc}"
                    ),
                ) from exc

            if not image_bytes:
                raise RegistrationProcessingError(
                    "FACE_IMAGE_EMPTY",
                    "Downloaded face_media_asset is empty",
                )

            face_input = FaceInput(
                track_id=registration_id,  # registration_id serves as track_id here
                image_data=image_bytes,
                kpss=payload.get("kpss"),
                quality_status=payload.get("quality_status"),
            )

            result = await self._use_case.execute(face_input, person_id, registration_id)

            await self._publish_completed(
                person_id=person_id,
                registration_id=registration_id,
                status="indexed",
                result=result,
                media_asset=media_asset,
                source_media_asset_id=source_media_asset_id,
                correlation_id=correlation_id,
                failure_code=None,
                failure_message=None,
            )

        except RegistrationProcessingError as exc:
            logger.error(
                "Registration failed person_id=%s registration_id=%s code=%s message=%s",
                person_id,
                registration_id,
                exc.failure_code,
                exc,
                exc_info=True,
            )
            await self._publish_failed_if_possible(
                person_id=person_id,
                registration_id=registration_id,
                media_asset=media_asset,
                source_media_asset_id=source_media_asset_id,
                correlation_id=correlation_id,
                failure_code=exc.failure_code,
                failure_message=str(exc),
            )
        except Exception as exc:
            logger.error(
                "Registration failed person_id=%s registration_id=%s: %s",
                person_id,
                registration_id,
                exc,
                exc_info=True,
            )
            await self._publish_failed_if_possible(
                person_id=person_id,
                registration_id=registration_id,
                media_asset=media_asset,
                source_media_asset_id=source_media_asset_id,
                correlation_id=correlation_id,
                failure_code="PROCESSING_ERROR",
                failure_message=str(exc),
            )

    async def _publish_completed(
        self,
        person_id: str,
        registration_id: str,
        status: str,
        result: dict,
        media_asset: dict,
        source_media_asset_id,
        correlation_id: str,
        failure_code,
        failure_message,
    ) -> None:
        envelope = self._publisher.build_envelope(
            event_name="registration_processing.completed",
            correlation_id=correlation_id,
            payload={
                "person_id": person_id,
                "registration_id": registration_id,
                "status": status,
                "failure_code": failure_code,
                "failure_message": failure_message,
                "validation_notes": None,
                "embedding_model": result.get("embedding_model"),
                "embedding_version": result.get("embedding_version"),
                "indexed_at": result.get("indexed_at"),
                "face_image_media_asset": media_asset if status == "indexed" else None,
                "source_media_asset_id": source_media_asset_id,
                "event_source": "ai_service",
            },
        )
        await self._publisher.publish(settings.REDIS_STREAM_AI_BACKEND, envelope)
        logger.info(
            "Published registration_processing.completed registration_id=%s status=%s",
            registration_id,
            status,
        )

    async def _publish_failed_if_possible(
        self,
        *,
        person_id,
        registration_id,
        media_asset,
        source_media_asset_id,
        correlation_id: str,
        failure_code: str,
        failure_message: str,
    ) -> None:
        if not isinstance(person_id, str) or not person_id.strip():
            logger.error(
                "Cannot publish registration failure without person_id: code=%s message=%s",
                failure_code,
                failure_message,
            )
            return
        if not isinstance(registration_id, str) or not registration_id.strip():
            logger.error(
                "Cannot publish registration failure without registration_id: code=%s message=%s",
                failure_code,
                failure_message,
            )
            return

        await self._publish_completed(
            person_id=person_id,
            registration_id=registration_id,
            status="failed",
            result={},
            media_asset=media_asset if isinstance(media_asset, dict) else None,
            source_media_asset_id=source_media_asset_id,
            correlation_id=correlation_id,
            failure_code=failure_code,
            failure_message=failure_message,
        )

    @staticmethod
    def _require_text(payload: dict, key: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise RegistrationProcessingError(
                "INVALID_REGISTRATION_REQUEST",
                f"registration.requested payload must include {key}",
            )
        return value

    @staticmethod
    def _validate_face_media_asset(value: Any) -> dict:
        if not isinstance(value, dict):
            raise RegistrationProcessingError(
                "MISSING_FACE_MEDIA_ASSET",
                "registration.requested payload must include face_media_asset",
            )

        missing_fields = [
            field
            for field in ("bucket_name", "object_key")
            if not isinstance(value.get(field), str) or not value.get(field).strip()
        ]
        if missing_fields:
            raise RegistrationProcessingError(
                "INVALID_FACE_MEDIA_ASSET",
                f"face_media_asset missing required field(s): {', '.join(missing_fields)}",
            )

        return value


class RegistrationProcessingError(Exception):
    def __init__(self, failure_code: str, message: str) -> None:
        super().__init__(message)
        self.failure_code = failure_code
