import cv2
import uuid
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
        # Cache lưu trữ frame_ref của MinIO cho từng track_id để tái sử dụng trong pha Burst
        self.track_frame_refs = {}
        
        # KPI Metrics
        self.total_bytes_sent = 0
        self.last_log_time = time.time()

    async def handle_realtime_frame(self, source_id: str, frame):
        """Luồng xử lý chính cho mỗi frame từ camera."""
        start_time = time.time()
        self.frame_count += 1
        logger.debug(f"handle_realtime_frame called. Frame #{self.frame_count}, shape={frame.shape}")
        
        context = {
            "source_id": source_id,
            "frame": frame,
            "frame_sequence": self.frame_count,
            "captured_at": datetime.utcnow().isoformat(),
            "full_frame_ref": None
        }

        context = self.motion_processor.process(context)
        ratio = context.get('motion_ratio', 0)
        logger.debug(f"Motion ratio: {ratio:.4f} (threshold={settings.MOTION_THRESHOLD})")
        if not context.get('motion_detected'):
            if self.frame_count % 100 == 0:
                logger.info(f"Processed {self.frame_count} frames, no motion detected. ratio={ratio:.4f}")
            return

        logger.info(f"Motion detected in frame {self.frame_count}, running face detection...")
        context = self.face_detector.process(context)
        if not context.get('detections'):
            return

        context = self.face_tracker.process(context)
        faces_to_emit = context.get('faces_to_emit', [])
        if not faces_to_emit: return

        # 1. Kiểm tra xem có cần upload ảnh gốc lên MinIO không?
        # Chỉ upload khi có khuôn mặt MỚI xuất hiện hoặc đến kỳ 5 phút.
        needs_upload = any(face['type'] in ['NEW', 'PERIODIC'] for face in faces_to_emit)
        
        full_frame_ref = None
        if needs_upload:
            logger.info(f"Faces to emit: {[f['type'] for f in faces_to_emit]}. Triggering MinIO upload...")
            full_frame_ref = self._dispatch_background_upload(source_id, frame)
            # Lưu lại ref cho các khuôn mặt trong frame này
            for face in faces_to_emit:
                self.track_frame_refs[face['track_id']] = full_frame_ref
        else:
            logger.debug("No new/periodic faces to emit, skipping MinIO upload.")
        
        # Căn chỉnh và cắt khuôn mặt (Face Alignment & Crop)
        context = self.face_cropper.process(context)
        processed_faces = context.get('processed_faces', [])

        for face in processed_faces:
            # 2. Lấy frame_ref từ cache (nếu frame hiện tại không upload, nó sẽ dùng lại ref của ảnh NEW trước đó)
            cached_ref = self.track_frame_refs.get(face['track_id'])
            context['full_frame_ref'] = cached_ref
            self._publish_to_ai_service(context, face)
            
            # Xóa cache nếu đây là ảnh Burst cuối cùng (không bắt buộc nhưng giúp sạch RAM)
            # Tuy nhiên cứ để đó, FaceTracker sẽ không phát ra event nữa sau khi hết Burst.

        # Ghi log KPI: FPS
        end_time = time.time()
        process_time = end_time - start_time
        fps = 1.0 / process_time if process_time > 0 else 0
        logger.debug(f"[KPI] Frame {self.frame_count} processed in {process_time*1000:.1f}ms. Est. FPS: {fps:.1f}")

    def _dispatch_background_upload(self, source_id, frame):
        """Tạo metadata và đẩy tác vụ upload MinIO ra Thread Pool."""
        safe_source_id = str(source_id).replace("://", "_").replace("/", "_").replace(":", "_").replace(".", "_")
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        object_key = f"recognition/full/{safe_source_id}/{timestamp}_{self.frame_count}.jpg"
        
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret: return None
        
        image_bytes = buffer.tobytes()
        
        # Fire-and-forget: Đẩy tác vụ I/O đồng bộ sang thread khác
        asyncio.create_task(asyncio.to_thread(self._sync_upload, object_key, image_bytes))
        
        return {
            "storage_provider": "minio",
            "bucket_name": settings.MINIO_BUCKET_NAME,
            "object_key": object_key,
            "original_filename": f"{self.frame_count}.jpg",
            "mime_type": "image/jpeg",
            "file_size": len(image_bytes),
            "asset_type": "recognition_snapshot"
        }

    def _sync_upload(self, object_key, image_bytes):
        """Hàm đồng bộ chạy trong Thread."""
        upload_start = time.time()
        storage_client.upload_image(object_key, image_bytes)
        upload_time_ms = (time.time() - upload_start) * 1000
        
        # Ghi log KPI: Blocking I/O
        if upload_time_ms > 100:
            logger.warning(f"[KPI] MinIO Upload took unusually long: {upload_time_ms:.1f}ms (Threshold: 100ms)")
        else:
            logger.info(f"[KPI] MinIO Upload fast: {upload_time_ms:.1f}ms. Object: {object_key}")

    def _publish_to_ai_service(self, context, face):
        """Đóng gói và gửi event recognition.requested sang Redis Stream."""
        try:
            payload = {
                "event_name": "recognition.requested",
                "event_version": "1.0.0",
                "message_id": str(uuid.uuid4()),
                "correlation_id": str(uuid.uuid4()),
                "producer": "pipeline",
                "occurred_at": context['captured_at'],
                "payload": {
                    "frame_sequence": context['frame_sequence'],
                    "captured_at": context['captured_at'],
                    "frame_width": context['frame'].shape[1],
                    "frame_height": context['frame'].shape[0],
                    "frame_ref": context['full_frame_ref'],
                    "pipeline_metadata": {
                        "track_id": face['track_id'],
                        "detection_score": float(face['score']),
                        "snapshot_type": face['type'],
                        "cropped_face_b64": face['image_b64'],
                        "kpss": face.get('kpss', []) # Bổ sung 5 điểm keypoints
                    }
                }
            }
            
            redis_stream_client.send_event(settings.STREAM_VISION_PROCESS, payload)
            logger.info(f"Published face {face['track_id']} ({face['type']}) to AI Service Stream")
        except Exception as e:
            logger.error(f"[Exception] Failed to publish face {face.get('track_id')} to Redis: {str(e)}")
            return # Thoát an toàn không làm chết luồng xử lý chính

        # Ghi log KPI: Redis Bandwidth
        b64_size = len(face['image_b64'].encode('utf-8'))
        self.total_bytes_sent += b64_size
        
        current_time = time.time()
        if current_time - self.last_log_time >= 60.0:
            kb_sent = self.total_bytes_sent / 1024
            logger.info(f"[KPI] Redis Bandwidth: Sent {kb_sent:.2f} KB in the last 60 seconds.")
            self.total_bytes_sent = 0
            self.last_log_time = current_time

    async def handle_registration(self, registration_data: dict):
        pass

pipeline_service = PipelineService()
