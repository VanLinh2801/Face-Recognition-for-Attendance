import cv2
import uuid
import base64
import asyncio
import time
from datetime import datetime
from app.clients.storage_client import storage_client
from app.clients.redis.stream_client import redis_stream_client
from app.processors.motion import MotionProcessor
from app.processors.face_detector import SCRFDFaceDetector
from app.processors.face_tracker import FaceTracker
from app.processors.face_cropper import FaceCropper
from app.core.config import settings
from app.utils.logger import logger

class PipelineService:
    def __init__(self):
        self.motion_processor = MotionProcessor()
        self.face_detector = SCRFDFaceDetector()
        self.face_tracker = FaceTracker()
        self.face_cropper = FaceCropper()
        self.frame_count = 0
        self.track_frame_refs = {}
        self._prev_motion_state = None  # để chỉ log khi trạng thái thay đổi
        self._no_face_streak = 0        # đếm liên tiếp không thấy mặt

    async def handle_realtime_frame(self, source_id: str, frame):
        self.frame_count += 1

        if self.frame_count % 100 == 0:
            h, w = frame.shape[:2]
            logger.info(f"[PIPELINE] ♥ Heartbeat frame={self.frame_count} res={w}x{h}")

        context = {
            "source_id": source_id,
            "frame": frame,
            "frame_sequence": self.frame_count,
            "captured_at": datetime.utcnow().isoformat(),
            "full_frame_ref": None
        }

        # 1. Phát hiện chuyển động
        context = self.motion_processor.process(context)
        motion = context.get('motion_detected')
        ratio  = context.get('motion_ratio', 0)

        # Chỉ log khi trạng thái thay đổi (có ↔ không)
        if motion != self._prev_motion_state:
            if motion:
                logger.info(f"[MOTION] ✓ Started  ratio={ratio:.4f}")
            else:
                logger.info(f"[MOTION] ✕ Stopped  ratio={ratio:.4f}")
            self._prev_motion_state = motion

        if not motion:
            return

        # 2. Phát hiện khuôn mặt
        context = self.face_detector.process(context)
        detections = context.get('detections', [])
        if not detections:
            self._no_face_streak += 1
            if self._no_face_streak % 30 == 1:   # log mỗi 30 lần liên tiếp bị miss
                logger.debug(f"[DETECTOR] No face x{self._no_face_streak}")
            return
        self._no_face_streak = 0
        logger.info(f"[DETECTOR] {len(detections)} face(s) detected")

        # 3. Tracking
        context = self.face_tracker.process(context)
        faces_to_emit = context.get('faces_to_emit', [])
        if not faces_to_emit:
            return
        logger.info(f"[TRACKER]  {len(faces_to_emit)} face(s) to emit")

        # 4. Upload ảnh gốc
        needs_upload = any(face['type'] in ['NEW', 'PERIODIC'] for face in faces_to_emit)
        full_frame_ref = None
        if needs_upload:
            full_frame_ref = self._dispatch_background_upload(source_id, frame)
            for face in faces_to_emit:
                self.track_frame_refs[face['track_id']] = full_frame_ref

        # 5. Cắt mặt
        context = self.face_cropper.process(context)
        processed_faces = context.get('processed_faces', [])

        for face in processed_faces:
            cached_ref = self.track_frame_refs.get(face['track_id'])
            context['full_frame_ref'] = cached_ref
            await self._publish_to_ai_service(context, face)

    def _dispatch_background_upload(self, source_id, frame):
        safe_source_id = str(source_id).replace("://", "_").replace("/", "_").replace(":", "_").replace(".", "_")
        object_key = f"full_frames/{safe_source_id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
        _, buffer = cv2.imencode('.jpg', frame)
        image_bytes = buffer.tobytes()
        asyncio.create_task(asyncio.to_thread(storage_client.upload_image, object_key, image_bytes))
        return {"bucket_name": settings.MINIO_BUCKET_NAME, "object_key": object_key}

    async def _publish_to_ai_service(self, context, face):
        try:
            # Convert bbox từ numpy float32 sang Python float để JSON serialize được
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
                    "captured_at": context['captured_at'],
                    "faces": [{
                        "track_id": face['track_id'],
                        "face_media_asset": context.get('full_frame_ref'),
                        "bbox": bbox,
                        "detection_confidence": float(face['score']),
                        "cropped_face_b64": face['image_b64'],
                        "full_frame_b64": base64.b64encode(cv2.imencode('.jpg', context['frame'])[1]).decode('utf-8') if settings.DEBUG else None,
                        "quality_status": "good"
                    }]
                }
            }
            await asyncio.wait_for(
                redis_stream_client.send_event(settings.STREAM_VISION_PROCESS, payload),
                timeout=2.0
            )
            logger.info(f"==> [SUCCESS] Published {face['track_id']} to AI Service")
        except asyncio.TimeoutError:
            logger.error(f"==> [TIMEOUT] Redis unreachable for track {face.get('track_id')}!")
        except Exception as e:
            logger.error(f"==> [ERROR] Failed to publish {face.get('track_id')}: {e}")

pipeline_service = PipelineService()
