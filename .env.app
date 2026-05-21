# ============================================================
#  face_attend — Docker Environment
# ============================================================
#  Run: docker compose --env-file .env.app up --build
#
#  GPU/CPU Selection: Set PIPELINE_DOCKERFILE below
#    - Dockerfile.cpu  → Intel/AMD CPU (no NVIDIA GPU)
#    - Dockerfile.gpu  → NVIDIA GPU with CUDA support
# ============================================================

# ---- Host Ports (map Docker service ports → your machine) ----
POSTGRES_HOST_PORT=5432
REDIS_HOST_PORT=6379
MINIO_API_HOST_PORT=9000
MINIO_CONSOLE_HOST_PORT=9001
QDRANT_HTTP_HOST_PORT=6333
QDRANT_GRPC_HOST_PORT=6334
BACKEND_HOST_PORT=8000
AI_SERVICE_HOST_PORT=8001
PIPELINE_HOST_PORT=8002
FRONTEND_HOST_PORT=3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_PIPELINE_WS_URL=ws://localhost:8002/ws/bbox

MEDIAMTX_RTSP_PORT=8554
MEDIAMTX_RTMP_PORT=1935
MEDIAMTX_HLS_PORT=8888
MEDIAMTX_WEBRTC_PORT=8889
MEDIAMTX_ICE_PORT=8189

# ---- PostgreSQL ----
POSTGRES_DB=attendance
POSTGRES_USER=attendance
POSTGRES_PASSWORD=attendance

# ---- MinIO ----
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=attendance
PIPELINE_MINIO_BUCKET=face-recognition

# ---- App Settings ----
LOG_LEVEL=INFO
ENV=production
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REDIS_STREAM_PIPELINE_AI=pipeline_ai

# ---- Admin Seed ----
AUTH_SEED_ADMIN_USERNAME=admin
AUTH_SEED_ADMIN_PASSWORD=admin123
JWT_ACCESS_EXPIRES_SECONDS=86400

# ---- AI Service Thresholds ----
QDRANT_COLLECTION=person_faces_antelopev2
INSIGHTFACE_MODEL_NAME=antelopev2
RECOGNITION_THRESHOLD=0.65
SPOOF_THRESHOLD=0.70
RECOGNITION_BUFFER_EXPECTED_CANDIDATES=5

# ---- Pipeline Camera ----
CAMERA_SOURCES=rtsp://mediamtx:8554/mystream
MOTION_THRESHOLD=0.02
FRAME_INTERVAL=0.1
DEBUG=false
MIN_FACE_SIZE_PX=90
REQUIRE_FULL_KPS=true
MIN_KPS_DIST_PX=2.0
FACE_OVERLAP_IOU_THRESHOLD=0.5
MAX_FACE_YAW_DEG=45.0
MIN_FACE_SHARPNESS=50.0
MIN_FACE_DETECTION_CONFIDENCE=0.65
MIN_FACE_BRIGHTNESS=65.0
MAX_INITIAL_SNAPSHOTS=5

# ---- AI Service Dockerfile (CPU or GPU) ----
# Choose: Dockerfile.cpu (no GPU) or Dockerfile.gpu (NVIDIA GPU)
AI_SERVICE_DOCKERFILE=Dockerfile.gpu

# ---- Pipeline Dockerfile (CPU or GPU) ----
# Choose: Dockerfile.cpu (no GPU) or Dockerfile.gpu (NVIDIA GPU)
PIPELINE_DOCKERFILE=Dockerfile.gpu
