"""ACCESS and ONBOARDING orchestration."""

from __future__ import annotations

import logging
from typing import Any

from .core.config import Settings
from .core.schemas import (
    AccessResult,
    AccessTask,
    FrameResolution,
    OnboardingResult,
    OnboardingTask,
)
from .io.image_loader import ImageLoader
from .io.streams import RedisStreamClient
from .store.qdrant_store import QdrantStore
from .vision.detection import FaceDetector, QualityGate
from .vision.embedding import Embedder
from .vision.spoof import SpoofChecker

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._streams = RedisStreamClient(
            host=settings.redis_host,
            port=settings.redis_port,
            input_stream=settings.redis_input_stream,
            output_stream=settings.redis_output_stream,
            consumer_group=settings.redis_consumer_group_ai,
            consumer_name=settings.redis_consumer_name,
        )
        self._loader = ImageLoader(settings.image_fetch_timeout_seconds)
        self._detector = FaceDetector(settings.models.detector)
        self._spoof_checker = SpoofChecker(settings.models.spoof)
        self._quality_gate = QualityGate(
            min_image_size=settings.min_image_size,
            min_face_size=settings.min_face_size,
        )
        self._embedder = Embedder(
            embedding_size=settings.embedding_size,
            model_name=settings.models.recognizer,
        )
        self._qdrant = QdrantStore(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            collection_name=settings.qdrant_collection,
            embedding_size=settings.embedding_size,
            match_threshold=settings.qdrant_match_threshold,
        )

    def bootstrap(self) -> None:
        logger.info(
            "Configured models detector=%s spoof=%s recognizer=%s",
            self._detector.model_name,
            self._spoof_checker.model_name,
            self._embedder.model_name,
        )
        self._streams.ensure_group()
        self._qdrant.ensure_collection()

    def run(self) -> None:
        while True:
            processed = self.process_once()
            if self._settings.run_once:
                return
            if not processed:
                continue

    def process_once(self) -> bool:
        message = self._streams.read(block_ms=self._settings.redis_block_ms)
        if message is None:
            return False

        message_id, payload = message
        logger.info("Received stream message %s", message_id)

        result_payload = self._dispatch(payload)
        self._streams.publish_result(result_payload)
        self._streams.acknowledge(message_id)
        logger.info("Processed and acknowledged %s", message_id)
        return True

    def _dispatch(self, payload: dict[str, Any]) -> dict[str, Any]:
        task_type = payload.get("task_type")
        if task_type == "ACCESS":
            task = AccessTask.model_validate(payload)
            return self._handle_access(task).model_dump(mode="json")
        if task_type == "ONBOARDING":
            task = OnboardingTask.model_validate(payload)
            return self._handle_onboarding(task).model_dump(mode="json")
        raise ValueError(f"Unsupported task_type: {task_type}")

    def _handle_access(self, task: AccessTask) -> AccessResult:
        try:
            image = self._loader.load(task.image_url)
        except Exception as exc:
            return AccessResult(
                event_id=task.event_id,
                camera_id=task.camera_id,
                timestamp=task.timestamp,
                image_url=task.image_url,
                status="ERROR",
                message=f"Unable to fetch image: {exc}",
            )

        resolution = FrameResolution(width=image.width, height=image.height)
        detection = self._detector.detect(image, task.image_url)

        if not detection.faces:
            return AccessResult(
                event_id=task.event_id,
                camera_id=task.camera_id,
                timestamp=task.timestamp,
                image_url=task.image_url,
                status="NO_FACE",
                frame_resolution=resolution,
                message="No face detected in the image",
            )

        if len(detection.faces) > 1:
            return AccessResult(
                event_id=task.event_id,
                camera_id=task.camera_id,
                timestamp=task.timestamp,
                image_url=task.image_url,
                status="MULTIPLE_FACES",
                frame_resolution=resolution,
                message="Multiple faces detected in the image",
            )

        face = detection.faces[0]
        if self._quality_gate.is_low_quality(image, face):
            return AccessResult(
                event_id=task.event_id,
                camera_id=task.camera_id,
                timestamp=task.timestamp,
                image_url=task.image_url,
                status="LOW_QUALITY",
                bounding_box=face,
                frame_resolution=resolution,
                message="Detected face did not pass quality gate",
            )

        embedding = self._embedder.embed(image, face)
        best_match = self._qdrant.search(embedding)
        if best_match is not None:
            matched_label = (
                "EMPLOYEE_CANDIDATE"
                if best_match["payload"].get("kind") == "employee"
                else "STRANGER"
            )
            return AccessResult(
                event_id=task.event_id,
                camera_id=task.camera_id,
                timestamp=task.timestamp,
                image_url=task.image_url,
                status="SUCCESS",
                qdrant_vector_id=best_match["id"],
                is_new_vector=False,
                confidence_score=best_match["score"],
                bounding_box=face,
                frame_resolution=resolution,
                message="Matched existing vector in Qdrant",
                matched_label=matched_label,
            )

        vector_id = self._qdrant.upsert(
            embedding,
            payload={
                "kind": "stranger",
                "camera_id": task.camera_id,
                "source": "access",
                "image_url": task.image_url,
                "timestamp": task.timestamp,
            },
        )
        return AccessResult(
            event_id=task.event_id,
            camera_id=task.camera_id,
            timestamp=task.timestamp,
            image_url=task.image_url,
            status="SUCCESS",
            qdrant_vector_id=vector_id,
            is_new_vector=True,
            confidence_score=0.0,
            bounding_box=face,
            frame_resolution=resolution,
            message="Created new stranger vector in Qdrant",
            matched_label="STRANGER",
        )

    def _handle_onboarding(self, task: OnboardingTask) -> OnboardingResult:
        try:
            image = self._loader.load(task.image_url)
            detection = self._detector.detect(image, task.image_url)
            if not detection.faces:
                return OnboardingResult(
                    employee_code=task.employee_code,
                    status="ERROR",
                    message="No face detected for onboarding image",
                )
            if len(detection.faces) > 1:
                return OnboardingResult(
                    employee_code=task.employee_code,
                    status="ERROR",
                    message="Multiple faces detected for onboarding image",
                )

            face = detection.faces[0]
            if self._quality_gate.is_low_quality(image, face):
                return OnboardingResult(
                    employee_code=task.employee_code,
                    status="ERROR",
                    message="Onboarding face did not pass quality gate",
                )

            embedding = self._embedder.embed(image, face)
            vector_id = self._qdrant.upsert(
                embedding,
                payload={
                    "kind": "employee",
                    "employee_code": task.employee_code,
                    "source": "onboarding",
                    "image_url": task.image_url,
                    "timestamp": task.timestamp,
                },
            )
            return OnboardingResult(
                employee_code=task.employee_code,
                qdrant_vector_id=vector_id,
                status="SUCCESS",
                message="Vector extracted and saved to Qdrant",
            )
        except Exception as exc:
            return OnboardingResult(
                employee_code=task.employee_code,
                status="ERROR",
                message=f"Onboarding failed: {exc}",
            )
