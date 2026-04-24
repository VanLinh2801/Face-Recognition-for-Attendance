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
    STREAM_VISION_PROCESS: str = "stream:vision:frames_to_process"
    STREAM_REGISTRATION_REQ: str = "stream:pipeline:registration_requested"
    
    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "face-recognition"
    
    # Camera Settings
    # Chứa danh sách URL camera hoặc ID, phân tách bằng dấu phẩy
    # Ví dụ: "/dev/video0,rtsp://user:pass@192.168.1.1/stream"
    CAMERA_SOURCES: str = "0"
    
    # Thresholds & AI Settings
    MOTION_THRESHOLD: float = 0.05  # 5% pixel thay đổi
    FRAME_INTERVAL: float = 0.1     # Giây giữa các lần đọc frame (10 FPS)
    
    # SCRFD & Tracking
    SCRFD_MODEL_PATH: str = "apps\pipeline\app\models\scrfd_2.5g_bnkps.onnx"
    FACE_DETECTION_THRESHOLD: float = 0.5
    FACE_TRACKER_COOLDOWN: int = 300  # 5 phút (300 giây)
    MAX_INITIAL_SNAPSHOTS: int = 3   # Số ảnh tối đa trong 2 giây đầu

    class Config:
        env_file = ".env"

settings = Settings()
