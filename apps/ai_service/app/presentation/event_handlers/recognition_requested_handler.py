import hashlib
import logging
import uuid
from datetime import datetime, timezone

from app.application.use_cases.identify_faces import IdentifyFacesUseCase
from app.core.config import settings
from app.domain.entities.face import BoundingBox, FaceInput
from app.domain.entities.recognition_result import RecognitionDecision
from app.infrastructure.integration.minio_client import MinioImageClient
from app.infrastructure.integration.redis_publisher import RedisStreamPublisher

logger = logging.getLogger(__name__)


class RecognitionRequestedHandler:
    """
    Handles `recognition.requested` events from the pipeline_ai Redis Stream.

    For each face in the batch:
        - Downloads face crop from MinIO
        - Runs IdentifyFacesUseCase (spoof → embed → search → decide)
        - Publishes `recognition_event.detected` OR `unknown_event.detected` to ai_backend stream
        - SPOOFED faces produce no event (silent reject)
    """

    def __init__(
        self,
        use_case: IdentifyFacesUseCase,
        minio_client: MinioImageClient,
        publisher: RedisStreamPublisher,
    ) -> None:
        self._use_case = use_case
        self._minio = minio_client
        self._publisher = publisher

    async def handle(self, event: dict) -> None:
        payload = event.get("payload", {})
        correlation_id = event.get("correlation_id") or str(uuid.uuid4())

        stream_id = payload.get("stream_id", "unknown")
        frame_id = payload.get("frame_id", "unknown")
        frame_sequence = payload.get("frame_sequence", 0)
        captured_at = payload.get("captured_at")
        faces = payload.get("faces", [])

        logger.info(
            "====> [RECOGNITION] Received event: stream_id=%s, frame_id=%s, faces_count=%d",
            stream_id, frame_id, len(faces)
        )

        for face_data in faces:
            track_id = face_data.get("track_id", "unknown")
            media_asset = face_data.get("face_media_asset")
            image_b64 = face_data.get("cropped_face_b64")

            try:
                # Ưu tiên dùng ảnh base64 gửi kèm để giảm độ trễ MinIO
                if image_b64:
                    import base64
                    # Loại bỏ header base64 nếu có (ví dụ: data:image/jpeg;base64,...)
                    if "," in image_b64:
                        image_b64 = image_b64.split(",")[1]
                    image_bytes = base64.b64decode(image_b64)
                    logger.info("Successfully decoded base64 image for track_id=%s (size=%d bytes)", track_id, len(image_bytes))
                elif media_asset:
                    logger.info("Downloading image from MinIO for track_id=%s...", track_id)
                    image_bytes = await self._minio.download(
                        bucket_name=media_asset["bucket_name"],
                        object_key=media_asset["object_key"],
                    )
                else:
                    raise ValueError(f"No image data or media asset for track_id={track_id}")

                logger.info("Starting face identification for track_id=%s...", track_id)

                bbox_raw = face_data.get("bbox")
                if isinstance(bbox_raw, list) and len(bbox_raw) == 4:
                    # Pipeline gửi [x1, y1, x2, y2]
                    x1, y1, x2, y2 = bbox_raw
                    bbox = BoundingBox(x=x1, y=y1, width=x2-x1, height=y2-y1)
                elif isinstance(bbox_raw, dict):
                    bbox = BoundingBox(
                        x=bbox_raw.get("x", 0),
                        y=bbox_raw.get("y", 0),
                        width=bbox_raw.get("width", 0),
                        height=bbox_raw.get("height", 0),
                    )
                else:
                    bbox = None

                face_input = FaceInput(
                    track_id=track_id,
                    image_data=image_bytes,
                    bbox=bbox,
                    detection_confidence=face_data.get("detection_confidence"),
                    quality_status=face_data.get("quality_status"),
                )

                result = await self._use_case.execute(face_input)

                if result.decision == RecognitionDecision.SPOOFED:
                    logger.warning(
                        "Spoof rejected track_id=%s spoof_score=%.4f — no event emitted",
                        track_id,
                        result.spoof_score,
                    )
                    continue

                dedupe_key = hashlib.sha256(
                    f"{frame_id}:{track_id}".encode()
                ).hexdigest()

                if result.decision == RecognitionDecision.KNOWN:
                    await self._publish_recognition(
                        stream_id=stream_id,
                        frame_id=frame_id,
                        frame_sequence=frame_sequence,
                        track_id=track_id,
                        result=result,
                        dedupe_key=dedupe_key,
                        correlation_id=correlation_id,
                        snapshot_media_asset=media_asset,
                    )
                else:  # UNKNOWN
                    await self._publish_unknown(
                        stream_id=stream_id,
                        frame_id=frame_id,
                        frame_sequence=frame_sequence,
                        track_id=track_id,
                        detected_at=captured_at,
                        result=result,
                        dedupe_key=dedupe_key,
                        correlation_id=correlation_id,
                        snapshot_media_asset=media_asset,
                    )

            except Exception as exc:
                logger.error(
                    "Failed processing face track_id=%s: %s", track_id, exc, exc_info=True
                )

    async def _publish_recognition(
        self, stream_id, frame_id, frame_sequence, track_id,
        result, dedupe_key, correlation_id, snapshot_media_asset,
    ) -> None:
        envelope = self._publisher.build_envelope(
            event_name="recognition_event.detected",
            correlation_id=correlation_id,
            payload={
                "stream_id": stream_id,
                "frame_id": frame_id,
                "frame_sequence": frame_sequence,
                "track_id": track_id,
                "person_id": result.match.person_id,
                "face_registration_id": result.match.face_registration_id,
                "recognized_at": datetime.now(timezone.utc).isoformat(),
                "event_direction": "unknown",  # direction is determined by pipeline context
                "match_score": result.match.match_score,
                "spoof_score": result.spoof_score,
                "event_source": "ai_service",
                "dedupe_key": dedupe_key,
                "snapshot_media_asset": snapshot_media_asset,
                "raw_payload": None,
            },
        )
        await self._publisher.publish(settings.REDIS_STREAM_AI_BACKEND, envelope)
        logger.info(
            "Published recognition_event.detected person_id=%s track_id=%s score=%.4f",
            result.match.person_id,
            track_id,
            result.match.match_score,
        )

    async def _publish_unknown(
        self, stream_id, frame_id, frame_sequence, track_id,
        detected_at, result, dedupe_key, correlation_id, snapshot_media_asset,
    ) -> None:
        nearest_score = result.match.match_score if result.match else None
        envelope = self._publisher.build_envelope(
            event_name="unknown_event.detected",
            correlation_id=correlation_id,
            payload={
                "stream_id": stream_id,
                "frame_id": frame_id,
                "frame_sequence": frame_sequence,
                "track_id": track_id,
                "detected_at": detected_at,
                "event_direction": "unknown",
                "match_score": nearest_score,
                "spoof_score": result.spoof_score,
                "event_source": "ai_service",
                "dedupe_key": dedupe_key,
                "review_status": "new",
                "notes": None,
                "snapshot_media_asset": snapshot_media_asset,
                "raw_payload": None,
            },
        )
        await self._publisher.publish(settings.REDIS_STREAM_AI_BACKEND, envelope)
        logger.info(
            "Published unknown_event.detected track_id=%s nearest_score=%s",
            track_id,
            f"{nearest_score:.4f}" if nearest_score is not None else "N/A",
        )
