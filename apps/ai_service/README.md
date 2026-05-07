# AI Service

Microservice chịu trách nhiệm toàn bộ logic nhận diện khuôn mặt trong hệ thống Camera AI Attendance.

## Trách nhiệm

| Trách nhiệm | Chi tiết |
|---|---|
| **Anti-spoofing** | Tự chạy MiniFASNet (ONNX) — không phụ thuộc Pipeline |
| **Embedding** | InsightFace ArcFace `buffalo_l` → vector 512-d |
| **Vector search** | Qdrant cosine similarity → top-1 match |
| **Registration indexing** | Nhận `registration.requested`, embed và upsert Qdrant |
| **Event publishing** | Phát `recognition_event.detected` / `unknown_event.detected` / `registration_processing.completed` |

**AI Service KHÔNG làm:** face detection, tracking, quality filtering, HTTP API cho realtime path.

---

## Kiến trúc nội bộ (Clean Architecture)

```
app/
├── core/               # Config (pydantic-settings, env vars)
├── domain/
│   ├── entities/       # FaceInput, FaceEmbedding, RecognitionResult
│   └── interfaces/     # IFaceEmbedder, IAntiSpoofer, IVectorStore (abstract)
├── application/
│   └── use_cases/      # IdentifyFacesUseCase, RegisterFaceUseCase
├── infrastructure/
│   ├── ai_models/      # InsightFaceEmbedder, OnnxAntiSpoofer
│   ├── persistence/    # QdrantVectorStore
│   └── integration/    # RedisConsumer, RedisPublisher, MinioImageClient
├── presentation/
│   └── event_handlers/ # RecognitionRequestedHandler, RegistrationRequestedHandler
├── bootstrap/
│   └── container.py    # Composition root / DI
└── main.py             # FastAPI app + lifespan
```

---

## Luồng xử lý

### Recognition (Realtime)

```
Redis Stream pipeline_ai
  └─ event: recognition.requested
       └─ RecognitionRequestedHandler
            └─ For each face:
                 1. Download face crop từ MinIO
                 2. OnnxAntiSpoofer.predict()
                    spoof_score < 0.70 → REJECT (không emit event)
                 3. InsightFaceEmbedder.extract() → 512-d vector
                 4. QdrantVectorStore.search() → top-1 match
                    score ≥ 0.45 → recognition_event.detected → Redis ai_backend
                    score < 0.45 → unknown_event.detected    → Redis ai_backend
```

### Registration (Async)

```
Redis Stream pipeline_ai
  └─ event: registration.requested
       └─ RegistrationRequestedHandler
            1. Download ảnh từ MinIO
            2. InsightFaceEmbedder.extract()
            3. QdrantVectorStore.upsert()
            4. registration_processing.completed → Redis ai_backend
               status: "indexed" | "failed"
```

---

## Thresholds

| Threshold | Giá trị mặc định | Env var | Ý nghĩa |
|---|---|---|---|
| Recognition | `0.45` | `RECOGNITION_THRESHOLD` | Cosine similarity ≥ ngưỡng → known person |
| Anti-spoof | `0.70` | `SPOOF_THRESHOLD` | Real-face score ≥ ngưỡng → pass (thấp hơn = spoof) |

> Tất cả threshold là env var, **không hardcode** trong logic.

---

## Cài đặt & chạy local

### 1. Tạo virtual environment

```bash
cd apps/ai_service
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### 2. Chuẩn bị model weights

```
apps/ai_service/
└── models/
    ├── insightface/     # InsightFace sẽ tự download buffalo_l vào đây
    └── anti_spoof/
        └── minifasnet.onnx   # Tải từ: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
```

### 3. Tạo file `.env`

```env
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

INSIGHTFACE_MODEL_DIR=./models/insightface
ANTI_SPOOF_MODEL_PATH=./models/anti_spoof/minifasnet.onnx

RECOGNITION_THRESHOLD=0.45
SPOOF_THRESHOLD=0.70
LOG_LEVEL=INFO
```

### 4. Khởi động services phụ thuộc

```bash
# Từ root của repo
docker-compose up redis qdrant minio -d
```

### 5. Chạy service

```bash
uvicorn app.main:app --reload --port 8001
```

Health check: `GET http://localhost:8001/health`

---

## Chạy bằng Docker

```bash
# Build
docker build -t ai_service:dev .

# Run
docker run --rm \
  --env-file .env \
  -v $(pwd)/models:/app/models \
  -p 8001:8000 \
  ai_service:dev
```

---

## Redis Streams

| Stream | Hướng | Events |
|---|---|---|
| `pipeline_ai` | **Đọc** (consume) | `recognition.requested`, `registration.requested` |
| `ai_backend` | **Ghi** (publish) | `recognition_event.detected`, `unknown_event.detected`, `registration_processing.completed` |

Contracts chi tiết xem tại: [`packages/contracts/`](../../packages/contracts/)

---

## Phụ thuộc ngoài

| Service | Cách dùng |
|---|---|
| **Redis** | Consumer group trên stream `pipeline_ai`; publish sang `ai_backend` |
| **Qdrant** | Lưu và tìm kiếm vector embedding |
| **MinIO** | Download face crop image theo `bucket_name` + `object_key` |

---

## Mở rộng sau này

- [ ] Thêm GPU support (`onnxruntime-gpu`, `ctx_id=0` với CUDA)
- [ ] Thêm `/admin/reindex` HTTP endpoint để rebuild Qdrant từ backup
- [ ] Metrics: inference latency, Qdrant search latency, spoof reject rate
- [ ] Dead-letter handling cho message consume thất bại nhiều lần
