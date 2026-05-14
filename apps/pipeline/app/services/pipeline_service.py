import cv2
import uuid
import base64
import asyncio
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional
import numpy as np
from app.clients.storage_client import storage_client
from app.clients.redis.stream_client import redis_stream_client
from app.processors.motion import MotionProcessor
from app.processors.face_detector import SCRFDFaceDetector
from app.processors.face_tracker import FaceTracker
from app.processors.face_cropper import FaceCropper
from app.processors.face_quality_filter import FaceQualityFilter
from app.core.config import settings
from app.utils.logger import logger

class PipelineService:
    def __init__(self):
        self.motion_processor = MotionProcessor()
        self.face_detector = SCRFDFaceDetector()
        self.face_tracker = FaceTracker()
        self.face_quality_filter = FaceQualityFilter()
        self.face_cropper = FaceCropper()
        self.frame_count = 0
        self.track_frame_refs = {}
        self._no_face_streak = 0

    async def handle_realtime_frame(self, source_id: str, frame):
        self.frame_count += 1
        h, w = frame.shape[:2]

        if self.frame_count % 100 == 0:
            logger.info(f"[PIPELINE] ♥ Heartbeat frame={self.frame_count} res={w}x{h}")

        context = {
            "source_id": source_id,
            "frame": frame,
            "frame_width": w,
            "frame_height": h,
            "frame_sequence": self.frame_count,
            "captured_at": datetime.utcnow().isoformat(),
            "full_frame_ref": None
        }

        # 1. Phát hiện chuyển động
        context = self.motion_processor.process(context)
        motion = context.get('motion_detected')
        has_active_tracks = len(self.face_tracker.tracks) > 0
        if not motion and not has_active_tracks:
            return

        # 2. Phát hiện khuôn mặt
        context = self.face_detector.process(context)
        detections = context.get('detections', [])
        if not detections:
            self._no_face_streak += 1
            if self._no_face_streak % 30 == 1:
                logger.debug(f"[DETECTOR] No face x{self._no_face_streak}")
            return
        self._no_face_streak = 0
        logger.debug(f"[DETECTOR] {len(detections)} face(s) detected")

        # 3. Tracking — gán track_id cho mỗi detection
        context = self.face_tracker.process(context)

        # 4. Quality filter — chạy SAU tracker để có track_id, set _filter_passed_track_ids
        context = self.face_quality_filter.process(context)

        # Tracker đọc filter feedback để biết frame nào đã pass
        self.face_tracker.sync_filter_passed(context.get('_filter_passed_track_ids', {}))

        filtered_faces = context.get('filtered_faces', [])

        # 5. Upload ảnh gốc — chỉ khi có face pass quality filter mới cần upload
        needs_upload = bool(filtered_faces) and any(face['type'] in ['NEW', 'PERIODIC'] for face in filtered_faces)
        full_frame_ref = None
        if needs_upload:
            full_frame_ref = self._dispatch_background_upload(source_id, frame)
            for face in filtered_faces:
                self.track_frame_refs[face['track_id']] = full_frame_ref

        # 6. Cắt mặt và publish — chỉ với face đã pass quality
        context['faces_to_emit'] = filtered_faces
        context = self.face_cropper.process(context)
        processed_faces = context.get('processed_faces', [])

        for face in processed_faces:
            cached_ref = self.track_frame_refs.get(face['track_id'])
            context['full_frame_ref'] = cached_ref
            await self._publish_to_ai_service(context, face)

    async def handle_registration(self, envelope: dict):
        payload = envelope.get("payload", {})
        correlation_id = envelope.get("correlation_id") or str(uuid.uuid4())
        person_id = payload["person_id"]
        registration_id = payload["registration_id"]
        source_media_asset = payload["source_media_asset"]
        source_media_asset_id = source_media_asset.get("media_asset_id")

        logger.info(
            "[REGISTRATION] Start registration_id=%s person_id=%s",
            registration_id,
            person_id,
        )

        try:
            image_bytes = await asyncio.to_thread(
                storage_client.download_image,
                source_media_asset["object_key"],
                source_media_asset.get("bucket_name"),
            )
            if not image_bytes:
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="IMAGE_DOWNLOAD_FAILED",
                    failure_message="Could not download source image from MinIO",
                    source_media_asset_id=source_media_asset_id,
                )
                return

            frame = self._decode_image(image_bytes)
            if frame is None:
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="IMAGE_DECODE_FAILED",
                    failure_message="Could not decode source image",
                    source_media_asset_id=source_media_asset_id,
                )
                return

            context = {"frame": frame}
            context = self.face_detector.process(context)
            detections = context.get("detections", [])

            if not detections:
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="NO_FACE",
                    failure_message="No face detected in registration image",
                    source_media_asset_id=source_media_asset_id,
                    pipeline_metadata={"detections_count": 0},
                )
                return

            if len(detections) > 1:
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="MULTIPLE_FACES",
                    failure_message="Multiple faces detected in registration image",
                    source_media_asset_id=source_media_asset_id,
                    pipeline_metadata={"detections_count": len(detections)},
                )
                return

            detection = detections[0]
            face = {
                "track_id": registration_id,
                "bbox": detection["bbox"],
                "score": detection["score"],
                "kpss": detection.get("kpss"),
                "type": "REGISTRATION",
            }
            crop_context = {
                "frame": frame,
                "faces_to_emit": [face],
            }
            crop_context = self.face_cropper.process(crop_context)
            processed_faces = crop_context.get("processed_faces", [])
            if not processed_faces or not processed_faces[0].get("image_b64"):
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="CROP_FAILED",
                    failure_message="Could not crop face from registration image",
                    source_media_asset_id=source_media_asset_id,
                    pipeline_metadata={"bbox": detection["bbox"]},
                )
                return

            processed_face = processed_faces[0]
            crop_bytes = base64.b64decode(processed_face["image_b64"])
            face_media_asset = await self._upload_registration_face_crop(
                person_id=person_id,
                registration_id=registration_id,
                crop_bytes=crop_bytes,
            )
            if face_media_asset is None:
                await self._publish_registration_input_validated(
                    person_id=person_id,
                    registration_id=registration_id,
                    correlation_id=correlation_id,
                    status="rejected",
                    failure_code="UPLOAD_FAILED",
                    failure_message="Could not upload prepared face crop",
                    source_media_asset_id=source_media_asset_id,
                    pipeline_metadata={"bbox": detection["bbox"]},
                )
                return

            pipeline_metadata = {
                "bbox": [float(v) for v in detection["bbox"]],
                "detection_confidence": float(detection["score"]),
                "kpss": processed_face.get("kpss"),
                "crop_scale": processed_face.get("crop_scale"),
                "detector": "scrfd",
            }
            await self._publish_registration_input_validated(
                person_id=person_id,
                registration_id=registration_id,
                correlation_id=correlation_id,
                status="accepted",
                source_media_asset_id=source_media_asset_id,
                prepared_face_media_asset=face_media_asset,
                quality_status="passed",
                pipeline_metadata=pipeline_metadata,
            )
            await self._publish_registration_to_ai_service(
                person_id=person_id,
                registration_id=registration_id,
                correlation_id=correlation_id,
                face_media_asset=face_media_asset,
                source_media_asset_id=source_media_asset_id,
                quality_status="passed",
                pipeline_metadata=pipeline_metadata,
                kpss=processed_face.get("kpss"),
            )
            logger.info(
                "[REGISTRATION] Published prepared face registration_id=%s to AI",
                registration_id,
            )

        except Exception as exc:
            logger.error(
                "[REGISTRATION] Failed registration_id=%s: %s",
                registration_id,
                exc,
                exc_info=True,
            )
            await self._publish_registration_input_validated(
                person_id=person_id,
                registration_id=registration_id,
                correlation_id=correlation_id,
                status="rejected",
                failure_code="PROCESSING_ERROR",
                failure_message=str(exc),
                source_media_asset_id=source_media_asset_id,
            )

    def _dispatch_background_upload(self, source_id, frame):
        safe_source_id = str(source_id).replace("://", "_").replace("/", "_").replace(":", "_").replace(".", "_")
        object_key = f"full_frames/{safe_source_id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
        _, buffer = cv2.imencode('.jpg', frame)
        image_bytes = buffer.tobytes()
        asyncio.create_task(asyncio.to_thread(storage_client.upload_image, object_key, image_bytes))
        return {"bucket_name": settings.MINIO_BUCKET_NAME, "object_key": object_key}

    async def _publish_to_ai_service(self, context, face):
        try:
            raw_bbox = face.get('bbox') or []
            bbox = [float(v) for v in raw_bbox]

            payload = {
                "event_name": "recognition.requested",
                "event_version": "1.0.0",
                "message_id": str(uuid.uuid4()),
                "correlation_id": str(uuid.uuid4()),
                "producer": "pipeline",
                "occurred_at": context['captured_at'],
                "payload": {
                    "stream_id": context.get('source_id', 'default_cam'),
                    "frame_id": f"frame_{context['frame_sequence']}",
                    "frame_sequence": context['frame_sequence'],
                    "frame_width": context['frame_width'],
                    "frame_height": context['frame_height'],
                    "captured_at": context['captured_at'],
                    "faces": [{
                        "track_id": face['track_id'],
                        "face_media_asset": context.get('full_frame_ref'),
                        "bbox": bbox,
                        "kpss": face.get('kpss'),
                        "detection_confidence": float(face['score']),
                        "cropped_face_b64": face['image_b64'],
                        "full_frame_b64": base64.b64encode(cv2.imencode('.jpg', context['frame'])[1]).decode('utf-8') if settings.DEBUG else None,
                        "quality_status": "good",
                        "crop_pixel_area": face.get('_quality_crop_area', 0)
                    }]
                }
            }
            await asyncio.wait_for(
                redis_stream_client.send_event(settings.STREAM_VISION_PROCESS, payload),
                timeout=2.0
            )
            det_conf = face.get('score', 0)
            logger.info(
                f"==> [SUCCESS] Published {face['track_id']} to AI Service | "
                f"SCRFD det_conf={det_conf:.4f}"
            )
        except asyncio.TimeoutError:
            logger.error(f"==> [TIMEOUT] Redis unreachable for track {face.get('track_id')}!")
        except Exception as e:
            logger.error(f"==> [ERROR] Failed to publish {face.get('track_id')}: {e}")

    @staticmethod
    def _decode_image(image_bytes: bytes):
        nparr = np.frombuffer(image_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    async def _upload_registration_face_crop(
        self,
        *,
        person_id: str,
        registration_id: str,
        crop_bytes: bytes,
    ) -> Optional[dict]:
        object_key = (
            "registration_faces/"
            f"{person_id}/{registration_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jpg"
        )
        uploaded = await asyncio.to_thread(
            storage_client.upload_image,
            object_key,
            crop_bytes,
            "image/jpeg",
            settings.MINIO_BUCKET_NAME,
        )
        if not uploaded:
            return None

        return {
            "media_asset_id": None,
            "storage_provider": "minio",
            "bucket_name": settings.MINIO_BUCKET_NAME,
            "object_key": object_key,
            "original_filename": f"registration_{registration_id}.jpg",
            "mime_type": "image/jpeg",
            "file_size": len(crop_bytes),
            "checksum": hashlib.sha256(crop_bytes).hexdigest(),
            "asset_type": "registration_face",
        }

    async def _publish_registration_input_validated(
        self,
        *,
        person_id: str,
        registration_id: str,
        correlation_id: str,
        status: str,
        failure_code: Optional[str] = None,
        failure_message: Optional[str] = None,
        source_media_asset_id: Optional[str] = None,
        prepared_face_media_asset: Optional[dict] = None,
        quality_status: Optional[str] = None,
        pipeline_metadata: Optional[dict] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        envelope = {
            "event_name": "registration_input.validated",
            "event_version": "1.0.0",
            "message_id": str(uuid.uuid4()),
            "correlation_id": correlation_id,
            "causation_id": None,
            "producer": "pipeline",
            "occurred_at": now,
            "payload": {
                "person_id": person_id,
                "registration_id": registration_id,
                "status": status,
                "validated_at": now,
                "event_source": "pipeline",
                "failure_code": failure_code,
                "failure_message": failure_message,
                "source_media_asset_id": source_media_asset_id,
                "prepared_face_media_asset": prepared_face_media_asset,
                "quality_status": quality_status,
                "validation_notes": failure_message,
                "pipeline_metadata": pipeline_metadata,
            },
        }
        await redis_stream_client.send_event(settings.STREAM_PIPELINE_EVENTS, envelope)

    async def _publish_registration_to_ai_service(
        self,
        *,
        person_id: str,
        registration_id: str,
        correlation_id: str,
        face_media_asset: dict,
        source_media_asset_id: Optional[str],
        quality_status: str,
        pipeline_metadata: dict,
        kpss: Optional[list] = None,
    ) -> None:
        envelope = {
            "event_name": "registration.requested",
            "event_version": "1.0.0",
            "message_id": str(uuid.uuid4()),
            "correlation_id": correlation_id,
            "causation_id": None,
            "producer": "pipeline",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "person_id": person_id,
                "registration_id": registration_id,
                "face_media_asset": face_media_asset,
                "source_media_asset_id": source_media_asset_id,
                "quality_status": quality_status,
                "kpss": kpss,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "pipeline_metadata": pipeline_metadata,
            },
        }
        await redis_stream_client.send_event(settings.STREAM_VISION_PROCESS, envelope)

pipeline_service = PipelineService()
