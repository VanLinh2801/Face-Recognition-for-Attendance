# Tổng quan folder dự án

Tài liệu này mô tả vai trò của từng folder trong repo để cả team hiểu rõ:

- folder nào là boundary kỹ thuật bắt buộc phải giữ
- folder nào là nơi chia sẻ contract
- folder nào là hạ tầng local
- folder nào chỉ là chỗ hỗ trợ test, mock, tài liệu

## 1. Mục tiêu của cấu trúc repo

Cấu trúc hiện tại được thiết kế theo nguyên tắc:

- chỉ chốt ranh giới giữa các service
- chưa áp đặt sẵn kiến trúc nội bộ của từng service
- ưu tiên contract-first để các thành viên có thể làm độc lập
- tách phần application, contract, hạ tầng, test fixture và tài liệu

Repo hiện tại ở mức monorepo tối giản, nghĩa là:

- mỗi service có một vùng riêng trong `apps/`
- phần giao tiếp liên-service được chốt trong `packages/contracts/`
- phần hạ tầng local được đặt ở `infra/`
- phần fixture và mock dùng để test độc lập được đặt ở `tests_shared/` và `tools/`

---

## 2. Folder gốc của repo

### `apps/`

Chứa các ứng dụng chính của hệ thống.

Đây là folder quan trọng nhất vì nó thể hiện boundary giữa các service.

Mỗi thư mục con trong `apps/` là một service hoặc một ứng dụng riêng có vòng đời phát triển riêng.

### `packages/`

Chứa phần dùng chung giữa nhiều service.

Trong repo này, trọng tâm của `packages/` là phần `contracts/`, tức các schema giao tiếp giữa service với service.

Không dùng `packages/` để chứa business logic của riêng một service.

### `infra/`

Chứa cấu hình hạ tầng local phục vụ chạy hệ thống và tích hợp các service.

Đây không phải nơi chứa business code.

### `scripts/`

Chứa các script hỗ trợ phát triển như:

- chạy local
- seed dữ liệu
- test

Các script ở đây là công cụ hỗ trợ, không phải logic nghiệp vụ cốt lõi.

### `tests_shared/`

Chứa fixture dùng chung cho nhiều service.

Folder này giúp các thành viên test độc lập trước khi tích hợp hệ thống thật.

### `tools/`

Chứa các công cụ hỗ trợ phát triển hoặc mock service.

Mục tiêu của `tools/` là cho phép từng người mô phỏng service còn lại khi bên kia chưa code xong.

### `docs/`

Chứa tài liệu kỹ thuật, quyết định kiến trúc, mô tả API, mô tả flow hệ thống.

Đây là nơi cả team tra cứu để thống nhất cách hiểu trước khi code.

### `.env.example`

File mẫu để mô tả các biến môi trường cần thiết cho local development.

Không chứa secret thật.

### `docker-compose.yml`

File định nghĩa cách chạy các thành phần hạ tầng local cùng nhau, ví dụ:

- PostgreSQL
- MinIO
- Qdrant

---

## 3. Chi tiết folder `apps/`

### `apps/frontend/`

Chứa ứng dụng giao diện người dùng.

Nhiệm vụ chính:

- hiển thị event điểm danh
- hiển thị lịch sử ra vào
- hiển thị danh sách người lạ
- quản lý thông tin nhân sự
- hiển thị trạng thái hệ thống

Nguyên tắc:

- frontend chỉ giao tiếp với backend
- frontend không gọi trực tiếp AI service
- frontend không gọi trực tiếp pipeline

#### `apps/frontend/src/`

Chứa source code chính của frontend.

#### `apps/frontend/public/`

Chứa static assets của frontend nếu cần.

### `apps/backend/`

Chứa backend service, là trung tâm business logic của hệ thống.

Nhiệm vụ chính:

- quản lý thông tin nhân sự
- quản lý attendance event
- quản lý unknown event
- quản lý metadata snapshot và object
- cung cấp API cho frontend
- tiếp nhận event từ pipeline
- gọi AI service khi cần các tác vụ chủ động như indexing

Nguyên tắc:

- backend là owner của PostgreSQL
- backend là source of truth ở mức nghiệp vụ
- backend không chứa logic inference lõi của AI

#### `apps/backend/app/`

Chứa source code ứng dụng backend.

Hiện tại repo không ép sẵn cấu trúc con trong folder này. Người phụ trách backend sẽ tự chia tiếp khi implementation rõ ràng.

#### `apps/backend/tests/`

Chứa test riêng của backend.

### `apps/ai_service/`

Chứa AI service, nơi sở hữu logic face recognition.

Nhiệm vụ chính:

- detect face
- anti-spoofing
- embedding extraction
- vector matching
- unknown detection
- quản lý vector index trên Qdrant

Nguyên tắc:

- AI service là owner của Qdrant
- AI service không sở hữu record nghiệp vụ như attendance chính thức
- AI service chỉ trả kết quả suy luận và thao tác trên index/vector

#### `apps/ai_service/app/`

Chứa source code ứng dụng AI service.

Cấu trúc con bên trong chưa bị ép sẵn, để owner của AI tự tổ chức theo hướng phù hợp với detector, anti-spoofing và embedding flow.

#### `apps/ai_service/tests/`

Chứa test riêng của AI service.

### `apps/pipeline/`

Chứa pipeline service, nơi xử lý luồng realtime từ camera.

Nhiệm vụ chính:

- đọc stream từ camera hoặc video source
- lấy frame theo tần suất phù hợp
- gọi AI service để nhận diện
- lọc trùng hoặc gom event
- upload snapshot khi cần
- gửi event sang backend

Nguyên tắc:

- pipeline không ghi trực tiếp PostgreSQL
- pipeline là nơi điều phối realtime path
- pipeline có thể gọi AI service và backend

#### `apps/pipeline/app/`

Chứa source code ứng dụng pipeline.

Cấu trúc chi tiết bên trong sẽ do owner của pipeline quyết định khi implementation rõ ràng.

#### `apps/pipeline/tests/`

Chứa test riêng của pipeline.

---

## 4. Chi tiết folder `packages/`

### `packages/contracts/`

Chứa các contract giao tiếp giữa service với service.

Đây là phần quan trọng nhất trong giai đoạn đầu vì nó cho phép team làm việc độc lập.

Contract ở đây có thể bao gồm:

- request schema
- response schema
- event payload schema
- ví dụ payload JSON
- tài liệu mô tả field và quy ước dữ liệu

Nguyên tắc:

- chỉ để DTO liên-service
- không để DTO nội bộ của frontend hoặc backend frontend API
- không để business logic

#### `packages/contracts/pipeline_ai/`

Chứa contract giữa pipeline và AI service.

Ví dụ:

- request gửi frame
- response trả về kết quả detect/match/spoof

#### `packages/contracts/pipeline_backend/`

Chứa contract giữa pipeline và backend.

Ví dụ:

- recognition event
- unknown event
- spoof alert event

#### `packages/contracts/backend_ai/`

Chứa contract giữa backend và AI service.

Ví dụ:

- index person
- rebuild index
- re-embed person

### `packages/common/`

Chứa thành phần kỹ thuật dùng chung giữa nhiều service nếu thực sự cần.

Ví dụ hợp lý:

- logging
- config helper
- base error
- utility kỹ thuật nhỏ

Nguyên tắc:

- không dùng làm chỗ gom business logic
- chỉ đưa vào đây những gì ít nhất 2 service thực sự cùng dùng

### `packages/clients/`

Chứa các client dùng để gọi service khác hoặc gọi storage theo cách thống nhất.

Ví dụ:

- AI client
- backend client
- storage client

Ý nghĩa:

- gom logic HTTP call vào một nơi
- chuẩn hóa timeout, retry, error handling
- tránh lặp code request ở nhiều nơi

Lưu ý:

- `clients/` không thực thi business flow
- orchestration thực tế vẫn nằm trong service đang xử lý

Ví dụ:

- pipeline dùng `AI client` để gọi AI
- pipeline dùng `backend client` để gửi event
- nhưng chính pipeline mới là nơi điều phối luồng realtime

---

## 5. Chi tiết folder `infra/`

### `infra/postgres/`

Chứa cấu hình hoặc bootstrap local cho PostgreSQL.

Lưu ý:

- migration nghiệp vụ không nhất thiết đặt ở đây
- folder này chủ yếu dành cho local infra bootstrap

### `infra/minio/`

Chứa cấu hình local cho MinIO hoặc các ghi chú liên quan tới bucket/object storage.

### `infra/qdrant/`

Chứa cấu hình local cho Qdrant.

### `infra/docker/`

Chứa script hoặc tài nguyên hỗ trợ container hóa nếu sau này cần mở rộng.

### `infra/nginx/`

Folder dự phòng nếu tương lai cần reverse proxy.

Ở giai đoạn hiện tại có thể chưa dùng tới.

---

## 6. Chi tiết folder `tests_shared/`

### `tests_shared/fixtures/`

Chứa dữ liệu test dùng chung cho nhiều service.

Mục tiêu:

- backend, AI, pipeline có thể dùng chung sample payload
- test contract dễ hơn
- mock service dễ hơn
- giảm lệch giữa môi trường test của từng người

#### `tests_shared/fixtures/images/`

Chứa ảnh mẫu phục vụ test detection, embedding, registration flow.

#### `tests_shared/fixtures/videos/`

Chứa video mẫu hoặc đoạn camera sample để test pipeline.

#### `tests_shared/fixtures/payloads/`

Chứa payload JSON mẫu cho contract test hoặc mock test.

---

## 7. Chi tiết folder `tools/`

### `tools/mock_ai_service/`

Chứa mock server hoặc mock script cho AI service.

Mục tiêu:

- người làm pipeline có thể test mà không cần AI hoàn thiện

### `tools/mock_backend_service/`

Chứa mock server hoặc mock script cho backend.

Mục tiêu:

- người làm pipeline có thể test gửi event mà không cần backend hoàn thiện

### `tools/replay_frames/`

Chứa công cụ replay ảnh hoặc video để mô phỏng camera input.

Mục tiêu:

- test pipeline ổn định hơn
- debug flow realtime không cần camera thật mọi lúc

---

## 8. Chi tiết folder `docs/`

### `docs/architecture/`

Chứa tài liệu kiến trúc tổng thể.

### `docs/api/`

Chứa tài liệu API hoặc ghi chú về endpoint, schema, example payload.

### `docs/decisions/`

Chứa các quyết định kỹ thuật hoặc kiến trúc để team theo dõi.

Ví dụ:

- vì sao dùng HTTP thay vì Redis Stream
- vì sao frontend chỉ gọi backend
- vì sao pipeline không ghi thẳng PostgreSQL

---

## 9. Nguyên tắc quan trọng khi mở rộng repo

- không đẩy business logic riêng của một service vào `packages/`
- không để AI hoặc pipeline sở hữu dữ liệu nghiệp vụ của backend
- không mở rộng `common/` một cách tùy tiện
- chỉ thêm shared contract khi thật sự là giao tiếp giữa nhiều service
- cấu trúc nội bộ từng service nên do owner của service đó quyết định

---

## 10. Kết luận

Repo được tổ chức theo hướng:

- rõ boundary giữa các service
- rõ nơi chốt contract
- rõ nơi chứa hạ tầng local
- rõ nơi chứa fixture và mock để làm việc độc lập
- không ép sẵn kiến trúc nội bộ của từng service quá sớm

Đây là cách tổ chức phù hợp cho một team nhỏ đang xây hệ thống demo nhưng vẫn muốn giữ hơi hướng production và khả năng mở rộng về sau.
