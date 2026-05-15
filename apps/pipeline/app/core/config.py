from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Specific
    APP_NAME: str = "Face Attend Pipeline"
    DEBUG: bool = False
    
    # API & Redis URLs
    AI_SERVICE_URL: str = "http://ai-service:8000"
    BACKEND_URL: str = "http://backend:8000"
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Redis Stream Keys
    STREAM_VISION_PROCESS: str = "pipeline_ai"
    STREAM_REGISTRATION_REQ: str = "pipeline_backend"
    STREAM_PIPELINE_EVENTS: str = "pipeline.backend.events"
    
    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "face-recognition"
    
    # Camera Settings
    # Chứa danh sách URL camera hoặc ID, phân tách bằng dấu phẩy
    # Ví dụ: "rtsp://localhost:8554/mystream"
    CAMERA_SOURCES: str = "rtsp://localhost:8554/mystream"
    
    # Thresholds & AI Settings
    MOTION_THRESHOLD: float = 0.005  # 0.5% pixel thay đổi → có chuyển động thực sự
    FRAME_INTERVAL: float = 0.1     # Giây giữa các lần đọc frame (10 FPS)
    
    # SCRFD & Tracking
    SCRFD_MODEL_PATH: str = r"app\models\scrfd_2.5g_bnkps.onnx"
    FACE_DETECTION_THRESHOLD: float = 0.65
    FACE_TRACKER_COOLDOWN: int = 300  # 5 phút (300 giây)
    FACE_TRACKER_MAX_AGE: float = 60.0 # Giây trước khi quên 1 track (mất dấu)
    MAX_INITIAL_SNAPSHOTS: int = 5   # Số ảnh đủ điều kiện ban đầu gửi sang AI

    # Face Quality Filter — hard filter: face fail thì không gửi lên ai_service
    MIN_FACE_SIZE_PX: int = 90       # Cạnh nhỏ nhất của SCRFD bbox trong ảnh gốc (px)
    REQUIRE_FULL_KPS: bool = True    # Yêu cầu đủ 5 keypoints
    MIN_KPS_DIST_PX: float = 2.0      # Khoảng cách tối thiểu giữa 2 keypoints (tránh trùng)
    FACE_OVERLAP_IOU_THRESHOLD: float = 0.5  # IoU > 0.5 → reject face nhỏ hơn
    MAX_FACE_YAW_DEG: float = 45.0   # Góc nghiêng tối đa
    MIN_FACE_SHARPNESS: float = 150.0 # Ngưỡng phương sai Laplacian để lọc ảnh mờ
    MIN_FACE_DETECTION_CONFIDENCE: float = 0.70 # SCRFD confidence tối thiểu để gửi AI
    MIN_FACE_BRIGHTNESS: float = 65.0 # Mean grayscale tối thiểu trên bbox mặt

    class Config:
        env_file = ".env"

settings = Settings()
