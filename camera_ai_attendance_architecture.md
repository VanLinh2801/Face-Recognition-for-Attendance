# Kiến trúc hệ thống Camera AI Attendance (Demo Production-like)

## 1. Mục tiêu hệ thống

Xây dựng một hệ thống điểm danh tự động bằng camera USB Full HD, sử dụng face recognition, có khả năng:

- Nhận luồng hình ảnh từ camera theo thời gian thực
- Nhận diện cán bộ công ty từ tập dữ liệu vài trăm người
- Phát hiện và ghi nhận người lạ
- Lưu lại lịch sử ra vào để truy xuất sau
- Có giao diện frontend để quan sát trạng thái và dữ liệu hệ thống

Đây là sản phẩm demo, nhưng kiến trúc cần có hơi hướng production để:
- dễ chia việc cho nhóm 3 người
- dễ mở rộng sau này
- hạn chế conflict khi code
- giữ ranh giới rõ giữa AI, nghiệp vụ và luồng xử lý kỹ thuật

---

## 2. Nguyên tắc kiến trúc tổng thể

Hệ thống được chia thành 3 service chính:

1. **Backend Service**
2. **AI Service**
3. **Pipeline Service**

Ngoài ra có thêm:

- **Frontend**
- **PostgreSQL**
- **MinIO**
- **Qdrant**

### Nguyên tắc chia service

- **Backend** sở hữu dữ liệu nghiệp vụ và business logic
- **AI Service** sở hữu logic nhận diện, embedding, vector search
- **Pipeline Service** sở hữu luồng ingest camera và điều phối xử lý realtime
- **Frontend** chỉ làm việc với backend, không gọi trực tiếp AI service

---

## 3. Các thành phần chính

### 3.1 Frontend

Frontend có nhiệm vụ:

- Hiển thị danh sách event điểm danh
- Hiển thị lịch sử ra vào
- Hiển thị người lạ được phát hiện
- Quản lý thông tin nhân sự
- Quan sát trạng thái hệ thống

### 3.2 Backend Service

Backend là trung tâm nghiệp vụ của hệ thống.

Nhiệm vụ chính:

- Quản lý thông tin cán bộ
- Quản lý event điểm danh
- Quản lý event người lạ
- Lưu metadata ảnh/snapshot
- Cung cấp API cho frontend
- Điều phối các tác vụ nghiệp vụ liên quan đến AI khi cần

### 3.3 AI Service

AI Service là nơi chứa toàn bộ logic nhận diện khuôn mặt.

Nhiệm vụ chính:

- Face Detection
- Anti-spoofing
- Embedding Extraction
- Matching / Similarity Search
- Unknown Detection
- Quản lý vector index trên Qdrant

### 3.4 Pipeline Service

Pipeline Service xử lý luồng dữ liệu realtime từ camera.

Nhiệm vụ chính:

- Đọc stream từ camera USB
- Lấy frame theo tần suất phù hợp
- Gửi frame/crop sang AI service
- Nhận kết quả nhận diện
- Gom/giảm trùng event
- Upload snapshot khi cần
- Gửi event sang backend

---

## 4. Dữ liệu và quyền sở hữu

### 4.1 PostgreSQL

PostgreSQL được backend sở hữu.

Dùng để lưu:

- Thông tin nhân sự
- Lịch sử attendance
- Event người lạ
- Metadata ảnh/snapshot
- Metadata camera
- Audit / trạng thái nghiệp vụ

> PostgreSQL là source of truth của hệ thống ở mức nghiệp vụ.

### 4.2 MinIO

MinIO dùng để lưu object/file, ví dụ:

- Ảnh đăng ký khuôn mặt
- Snapshot attendance
- Snapshot unknown
- Ảnh minh chứng

Cách sử dụng:

- Pipeline hoặc backend có thể upload object
- Backend giữ metadata nghiệp vụ của object trong PostgreSQL

> MinIO là nơi lưu file, còn backend giữ ý nghĩa nghiệp vụ của file đó.

### 4.3 Qdrant

Qdrant được AI Service sở hữu.

Dùng để:

- Lưu vector embedding
- Search nearest neighbors
- Quản lý collection/point phục vụ face matching
- Phục vụ nhận diện known / unknown

> Qdrant không phải source of truth nghiệp vụ, mà là serving/index store của recognition.

---

## 5. Luồng giao tiếp giữa các thành phần

### 5.1 Frontend ↔ Backend

Frontend chỉ gọi backend.

Frontend không gọi trực tiếp AI service.

Lý do:

- Backend giữ business logic
- Backend dễ kiểm soát auth, validation, logging
- Frontend không bị coupling với nhiều service nội bộ
- Kiến trúc sạch hơn và production-like hơn

### 5.2 Pipeline → AI Service

Pipeline gửi frame hoặc crop face sang AI service bằng **HTTP API đồng bộ**.

Ví dụ:
- `POST /infer/frame`
- `POST /infer/faces`

Đây là request-response, không phải webhook.

### 5.3 Pipeline → Backend

Sau khi có kết quả nhận diện, pipeline gửi event về backend bằng **HTTP event-ingestion API**.

Ví dụ:
- `POST /internal/events/recognition`
- `POST /internal/events/unknown`
- `POST /internal/events/spoof-alert`

### 5.4 Backend → AI Service

Backend gọi AI service khi cần các tác vụ chủ động từ UI hoặc nghiệp vụ, ví dụ:

- tạo embedding cho nhân sự mới
- rebuild index
- kiểm tra lại vector
- re-index khi đổi model

---

## 6. Tại sao dùng HTTP thay vì Redis Stream hoặc webhook

### 6.1 HTTP là đủ cho demo này

Trong hệ thống hiện tại, bottleneck chính không nằm ở HTTP mà nằm ở:

- đọc frame từ camera
- face detection
- anti-spoofing
- embedding inference
- vector search
- lưu snapshot

Vì vậy:

- Pipeline → AI dùng HTTP là hợp lý
- Pipeline → Backend dùng HTTP là hợp lý
- Frontend → Backend dùng HTTP là hợp lý

### 6.2 Chưa cần Redis Stream từ đầu

Redis Stream chỉ nên thêm khi thực sự cần:

- hàng đợi event lớn
- nhiều consumer
- retry message
- tách producer/consumer mạnh hơn
- event-driven phức tạp hơn

Ở giai đoạn demo, dùng Redis Stream ngay từ đầu sẽ làm hệ thống nặng và khó debug hơn.

### 6.3 Không dùng webhook cho flow nội bộ này

Các luồng hiện tại là:

- request-response
- event submission
- realtime UI update

Chúng không đúng bản chất webhook.

---

## 7. Realtime update lên frontend

Có 2 hướng phù hợp:

### Cách 1: Polling
Frontend gọi định kỳ:
- `GET /attendance/recent-events`
- `GET /unknown/recent-events`

Ưu điểm:
- đơn giản
- dễ làm
- phù hợp demo

### Cách 2: WebSocket
Backend push event mới lên frontend theo thời gian thực.

Ưu điểm:
- nhìn realtime hơn
- trải nghiệm đẹp hơn

Khuyến nghị:
- nếu cần làm nhanh: dùng polling
- nếu muốn giao diện đẹp hơn: dùng WebSocket

---

## 8. Có nên dùng Celery hoặc orchestrator không?

### 8.1 Không dùng cho realtime path chính

Luồng realtime chính là:

1. đọc frame
2. detect
3. anti-spoof
4. embedding
5. match
6. gửi event
7. lưu attendance/unknown

Luồng này cần ít độ trễ và dễ debug.

Vì vậy:

- không nên đưa Celery vào core realtime path ngay từ đầu
- không cần workflow orchestrator nặng cho demo này

### 8.2 Có thể dùng cho background jobs

Celery hoặc worker nền chỉ nên dùng cho các job như:

- rebuild embedding index
- re-embed toàn bộ nhân sự
- import batch dữ liệu
- cleanup snapshot cũ
- tạo report attendance
- đồng bộ dữ liệu nền

---

## 9. Quy tắc sở hữu dữ liệu và ghi/đọc storage

### 9.1 Backend
Backend nên được quyền:

- đọc/ghi PostgreSQL
- quản lý metadata nghiệp vụ
- điều phối nghiệp vụ
- truy vấn dữ liệu cho frontend

### 9.2 AI Service
AI service nên được quyền:

- đọc/ghi Qdrant
- tạo embedding
- search vector
- quản lý face index

AI service không nên tự sở hữu business record như:
- person record ở mức nghiệp vụ
- attendance event
- unknown event chính thức

### 9.3 Pipeline Service
Pipeline service nên:

- không ghi trực tiếp PostgreSQL
- có thể upload snapshot lên MinIO
- gửi event về backend
- detect/track/spoof trong realtime path và gửi face batch sang AI service để extract/search

---

## 10. Luồng xử lý chính

### 10.1 Use case: điểm danh người quen

1. Pipeline đọc frame từ camera
2. Pipeline chọn frame phù hợp để xử lý
3. Pipeline detect face, tracking, quality filtering và spoof/liveness
4. Pipeline crop face và gửi face batch sang AI service
5. AI service tạo embedding
6. AI service search Qdrant
7. AI service trả `recognition_search.completed` về pipeline
8. Pipeline gom/lọc kết quả
9. Pipeline gửi recognition event sang backend
10. Backend áp dụng business rule attendance
11. Backend lưu PostgreSQL
12. Frontend lấy dữ liệu từ backend để hiển thị

### 10.2 Use case: phát hiện người lạ

1. Pipeline đọc frame
2. Pipeline detect face, tracking, quality filtering và spoof/liveness
3. Pipeline gửi face batch sang AI service
4. AI service embedding + search và trả `recognition_search.completed`
5. Pipeline kết luận unknown khi AI trả `no_match`
5. Pipeline crop hoặc lưu snapshot
6. Pipeline upload snapshot lên MinIO nếu cần
7. Pipeline gửi unknown event sang backend
8. Backend lưu unknown event và metadata snapshot
9. Frontend hiển thị danh sách người lạ

### 10.3 Use case: đăng ký nhân sự mới

1. Frontend gửi thông tin nhân sự lên backend
2. Backend tạo person record trong PostgreSQL
3. Backend lưu ảnh hoặc metadata ảnh vào MinIO/PostgreSQL
4. Backend gọi AI service để tạo embedding
5. AI service tạo embedding từ ảnh
6. AI service upsert vector vào Qdrant
7. AI service trả trạng thái indexing
8. Backend cập nhật metadata liên quan
9. Frontend nhận kết quả từ backend

---

## 11. Chiến lược chia việc cho 3 người

Hệ thống có 3 model chính:

- Detector
- Anti-spoofing
- Embedding

Có thể chia theo hướng:

### Người 1
- nghiên cứu Detector
- phụ trách phần detect/crop/preprocess liên quan

### Người 2
- nghiên cứu Anti-spoofing
- phụ trách phần spoof/liveness decision

### Người 3
- nghiên cứu Embedding
- phụ trách phần vector search, matching, known/unknown

Khuyến nghị:
- mỗi người có **1 model trọng tâm để nghiên cứu**
- đồng thời sở hữu **1 đoạn flow tích hợp liên quan đến model đó**
- không nên chia kiểu “chỉ nghiên cứu, không dính code”

---

## 12. Quy tắc tổ chức code giữa các service

Không nên để mỗi service thích dùng kiến trúc gì thì dùng hoàn toàn tự do.

Nên thống nhất:

- style đặt tên
- cấu trúc thư mục nền
- cách quản lý config
- cách logging
- cách định nghĩa schema
- cách viết client gọi service khác
- cách xử lý error

### Nguyên tắc chung

Mỗi service đều nên có ít nhất:

- `api/`
- `core/`
- `schemas/`
- `main.py`

Sau đó mỗi service thêm phần riêng của mình.

---

## 13. Cấu trúc thư mục đề xuất

```text
camera-attendance-system/
├── apps/
│   ├── backend/
│   │   └── app/
│   │       ├── api/
│   │       ├── core/
│   │       ├── db/
│   │       ├── models/
│   │       ├── repositories/
│   │       ├── schemas/
│   │       ├── services/
│   │       └── main.py
│   │
│   ├── ai_service/
│   │   └── app/
│   │       ├── api/
│   │       ├── core/
│   │       ├── schemas/
│   │       ├── detectors/
│   │       ├── anti_spoofing/
│   │       ├── embedders/
│   │       ├── matchers/
│   │       ├── registry/
│   │       ├── pipelines/
│   │       └── main.py
│   │
│   └── pipeline/
│       └── app/
│           ├── api/
│           ├── core/
│           ├── schemas/
│           ├── camera/
│           ├── clients/
│           ├── processors/
│           ├── workers/
│           └── main.py
│
├── data/
│   ├── registered_faces/
│   ├── unknown_faces/
│   ├── snapshots/
│   └── logs/
│
├── docs/
│   └── architecture.md
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 14. Vai trò của từng service ở mức kiến trúc nội bộ

### Backend
Kiến trúc thiên về business:
- route
- service
- repository
- database layer

### AI Service
Kiến trúc thiên về inference pipeline:
- detector
- anti-spoofing
- embedding
- matcher
- registry
- pipeline inference

### Pipeline Service
Kiến trúc thiên về worker/processor:
- camera reader
- frame sampler
- inference worker
- event forwarding
- backend client
- AI client

---

## 15. Quy tắc migration PostgreSQL

PostgreSQL là phần nhạy cảm và dễ conflict nhất.

Khuyến nghị:

- chỉ định **1 schema owner** hoặc 1 người chịu trách nhiệm chính về migration
- tránh để cả 3 người cùng generate migration song song
- migration nên được tạo ở nhánh integration sau khi đồng bộ model
- AI và pipeline không nên ghi thẳng PostgreSQL nếu tránh được

Mục tiêu là:

- backend giữ ranh giới nghiệp vụ rõ
- schema không bị kéo bởi nhiều phía
- giảm conflict giữa các thành viên

---

## 16. Kết luận kiến trúc

Kiến trúc cuối cùng của hệ thống được chốt theo hướng:

- **Frontend chỉ giao tiếp với Backend**
- **Pipeline giao tiếp với AI service và Backend**
- **Backend sở hữu PostgreSQL và business logic**
- **AI Service sở hữu Qdrant và logic recognition**
- **MinIO dùng để lưu object, backend giữ metadata nghiệp vụ**
- **HTTP là giao thức chính giữa các service**
- **Chưa cần Redis Stream, webhook hay orchestrator nặng trong giai đoạn demo**
- **Có thể thêm background jobs sau nếu cần**
- **Codebase phải thống nhất convention toàn repo, nhưng từng service có thể tối ưu kiến trúc nội bộ theo bản chất riêng**

Đây là phương án cân bằng giữa:

- tính thực dụng
- khả năng chia việc cho nhóm 3 người
- khả năng demo ổn định
- hơi hướng production
- khả năng mở rộng về sau
