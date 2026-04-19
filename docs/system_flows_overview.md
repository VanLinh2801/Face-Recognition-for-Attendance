# Mô tả các luồng hoạt động của hệ thống

Tài liệu này mô tả các luồng chính của hệ thống Camera AI Attendance theo đúng boundary giữa:

- frontend
- backend
- AI service
- pipeline
- PostgreSQL
- MinIO
- Qdrant

## 1. Thành phần tham gia trong các luồng

### Frontend

Vai trò:

- hiển thị dữ liệu
- gửi thao tác từ người dùng lên backend

Frontend không gọi trực tiếp AI service hoặc pipeline.

### Backend

Vai trò:

- xử lý business logic
- lưu dữ liệu nghiệp vụ vào PostgreSQL
- cung cấp API cho frontend
- tiếp nhận event từ pipeline
- điều phối nghiệp vụ liên quan tới AI theo contract đã thống nhất

### AI Service

Vai trò:

- xử lý inference
- tạo embedding
- vector search
- xác định known, unknown, spoof
- quản lý index trên Qdrant

### Pipeline

Vai trò:

- đọc camera hoặc video source
- tiếp nhận và tiền xử lý dữ liệu ảnh trước khi đưa sang AI
- crop face hoặc vùng quan tâm khi cần
- đánh giá chất lượng ảnh đầu vào
- chuẩn hóa dữ liệu để AI luôn nhận input sạch và nhất quán
- gửi frame sang AI service
- lọc kết quả
- gửi event về backend
- upload snapshot khi cần

### PostgreSQL

Vai trò:

- source of truth ở mức nghiệp vụ

### MinIO

Vai trò:

- lưu object như ảnh khuôn mặt, snapshot, ảnh minh chứng

### Qdrant

Vai trò:

- lưu embedding và phục vụ similarity search

---

## 2. Luồng điểm danh người quen

Đây là luồng cốt lõi của hệ thống.

### Mục tiêu

Nhận diện một người đã đăng ký trong hệ thống và ghi nhận event điểm danh hoặc event ra vào.

### Các bước

1. Pipeline đọc frame từ camera.
2. Pipeline chọn frame phù hợp để xử lý.
3. Pipeline gửi request sang AI service theo contract `pipeline_ai`.
4. AI service thực hiện detect face.
5. AI service thực hiện anti-spoofing.
6. AI service tạo embedding.
7. AI service query Qdrant để tìm vector gần nhất.
8. AI service trả về kết quả nhận diện.
9. Pipeline lọc trùng và gom event trong khoảng thời gian phù hợp.
10. Nếu là người đã biết và không phải spoof, pipeline gửi `recognition event` về backend theo contract `pipeline_backend`.
11. Backend áp dụng business rule để xác định đây là check-in, check-out hay chỉ là event trùng cần bỏ qua.
12. Backend lưu record vào PostgreSQL.
13. Frontend gọi backend để hiển thị dữ liệu mới nhất.

### Dữ liệu chính được dùng

- frame từ camera
- kết quả detect/spoof/match từ AI
- attendance event lưu ở PostgreSQL

### Lưu ý kỹ thuật

- pipeline không tự lưu attendance vào PostgreSQL
- backend là nơi quyết định business meaning của event
- AI service chỉ cung cấp kết quả inference

---

## 3. Luồng phát hiện người lạ

### Mục tiêu

Phát hiện người không khớp với dữ liệu đã đăng ký và lưu lại để theo dõi.

### Các bước

1. Pipeline đọc frame từ camera.
2. Pipeline gửi frame sang AI service.
3. AI service detect face, anti-spoof, embed và search Qdrant.
4. AI service trả kết quả với trạng thái `is_unknown = true`.
5. Pipeline quyết định crop hoặc chụp snapshot làm minh chứng.
6. Pipeline upload ảnh snapshot lên MinIO nếu flow hiện tại yêu cầu.
7. Pipeline gửi `unknown event` về backend.
8. Backend lưu unknown event vào PostgreSQL cùng metadata snapshot.
9. Frontend truy vấn backend để hiển thị danh sách người lạ.

### Dữ liệu chính được dùng

- frame camera
- snapshot người lạ
- metadata object trên MinIO
- unknown event trong PostgreSQL

### Lưu ý kỹ thuật

- MinIO chỉ lưu file
- PostgreSQL giữ ý nghĩa nghiệp vụ của file
- AI service không tạo unknown business record chính thức

---

## 4. Luồng phát hiện spoof hoặc liveness fail

### Mục tiêu

Phát hiện trường hợp camera đang nhìn thấy ảnh chụp, video giả lập hoặc tín hiệu không hợp lệ theo logic anti-spoofing.

### Các bước

1. Pipeline gửi frame sang AI service.
2. AI service detect khuôn mặt và chạy anti-spoofing.
3. AI service trả kết quả `is_spoof = true` hoặc trạng thái liveness fail.
4. Pipeline không gửi recognition event bình thường.
5. Pipeline có thể chụp snapshot minh chứng.
6. Pipeline gửi `spoof alert event` sang backend.
7. Backend lưu cảnh báo vào PostgreSQL hoặc ghi log nghiệp vụ theo rule đã thống nhất.
8. Frontend hiển thị cảnh báo nếu có màn hình monitor phù hợp.

### Lưu ý kỹ thuật

- spoof alert không nên đi chung với recognition event thành một record nghiệp vụ mơ hồ
- nên có contract riêng để dễ xử lý và dễ monitor

---

## 5. Luồng đăng ký nhân sự mới

### Mục tiêu

Thêm một người mới vào hệ thống để lần sau có thể nhận diện.

### Các bước

1. Người dùng thao tác trên frontend để tạo nhân sự mới.
2. Frontend gửi thông tin lên backend.
3. Backend tạo person record trong PostgreSQL ở trạng thái chờ xử lý.
4. Backend lưu ảnh gốc hoặc metadata ảnh gốc để phục vụ flow xử lý tiếp theo.
5. Backend tạo yêu cầu xử lý dữ liệu đăng ký và chuyển yêu cầu đó sang pipeline theo contract đã thống nhất.
6. Pipeline nhận ảnh đăng ký hoặc nguồn ảnh tương ứng.
7. Pipeline thực hiện tiền xử lý dữ liệu:
8. Pipeline kiểm tra ảnh có đọc được hay không, số lượng khuôn mặt có hợp lệ hay không.
9. Pipeline crop face hoặc vùng cần thiết để chuẩn hóa đầu vào.
10. Pipeline đánh giá chất lượng ảnh theo các rule đã chốt như độ rõ, kích thước mặt, góc mặt, ánh sáng.
11. Nếu dữ liệu không đạt yêu cầu, pipeline trả trạng thái fail hoặc reject về backend.
12. Nếu dữ liệu đạt yêu cầu, pipeline gửi dữ liệu đã làm sạch sang AI service theo contract phù hợp.
13. AI service tạo embedding.
14. AI service upsert vector vào Qdrant.
15. AI service trả kết quả indexing về pipeline.
16. Pipeline gửi kết quả xử lý cuối cùng về backend.
17. Backend cập nhật trạng thái liên quan trong PostgreSQL.
18. Frontend nhận phản hồi thành công hoặc thất bại từ backend.

### Dữ liệu chính được dùng

- person profile
- raw face image
- cropped or validated face image
- embedding vector
- metadata indexing

### Lưu ý kỹ thuật

- person record chính thức phải do backend sở hữu
- backend không gửi ảnh thẳng sang AI service
- pipeline là lớp đứng trước AI để làm sạch dữ liệu đầu vào
- AI service không trở thành owner của hồ sơ nhân sự
- Qdrant chỉ là serving/index store cho nhận diện

---

## 6. Luồng truy xuất lịch sử ra vào

### Mục tiêu

Cho phép người dùng xem lịch sử check-in, check-out hoặc các event liên quan theo người, thời gian, camera.

### Các bước

1. Frontend gửi request truy vấn lên backend.
2. Backend đọc dữ liệu từ PostgreSQL.
3. Backend áp dụng filter, sort, paging theo yêu cầu.
4. Backend trả danh sách attendance record cho frontend.
5. Frontend hiển thị dữ liệu và hỗ trợ người dùng tra cứu.

### Ví dụ filter

- theo nhân sự
- theo phòng ban
- theo camera
- theo ngày
- theo khoảng thời gian
- theo loại event vào hoặc ra

### Lưu ý kỹ thuật

- frontend chỉ đọc qua backend
- không đọc trực tiếp từ PostgreSQL
- truy vấn lịch sử là flow nghiệp vụ của backend, không phải của AI service

---

## 7. Luồng truy xuất người lạ đã phát hiện

### Mục tiêu

Cho phép người dùng xem lại danh sách unknown event đã được hệ thống ghi nhận.

### Các bước

1. Frontend gửi request lên backend.
2. Backend truy vấn PostgreSQL để lấy unknown event.
3. Backend map metadata snapshot nếu có.
4. Backend trả dữ liệu về frontend.
5. Frontend hiển thị danh sách cùng ảnh minh chứng.

### Dữ liệu hiển thị có thể gồm

- thời gian phát hiện
- camera phát hiện
- snapshot URL hoặc object key
- confidence hoặc trạng thái AI liên quan

---

## 8. Luồng realtime cập nhật lên frontend

Hệ thống có thể hỗ trợ một trong hai hướng.

### Cách 1: Polling

1. Frontend gọi định kỳ backend để lấy event mới nhất.
2. Backend truy vấn PostgreSQL.
3. Frontend cập nhật danh sách event.

Ưu điểm:

- đơn giản
- dễ làm
- phù hợp demo giai đoạn đầu

### Cách 2: WebSocket

1. Backend duy trì kết nối realtime với frontend.
2. Khi có event mới được lưu, backend push dữ liệu lên frontend.
3. Frontend cập nhật màn hình gần như ngay lập tức.

Ưu điểm:

- realtime hơn
- trải nghiệm trực quan hơn

### Khuyến nghị

- phase 1 nên dùng polling
- phase sau có thể nâng cấp sang WebSocket

---

## 9. Luồng rebuild hoặc re-index dữ liệu khuôn mặt

### Mục tiêu

Cho phép hệ thống re-index khi:

- đổi model embedding
- sửa threshold
- thay đổi logic vector store

### Các bước

1. Quản trị viên thao tác từ frontend hoặc trigger từ backend.
2. Backend xác nhận yêu cầu nghiệp vụ.
3. Backend tạo yêu cầu rebuild hoặc re-index theo contract đã thống nhất.
4. Nếu flow cần đọc lại ảnh gốc, pipeline là nơi chuẩn bị lại dữ liệu và đánh giá chất lượng đầu vào trước khi gửi sang AI.
5. Pipeline gửi dữ liệu sạch hoặc request phù hợp sang AI service theo contract `backend_ai`.
6. AI service tạo lại embedding hoặc rebuild index trên Qdrant.
7. AI service trả trạng thái job cho pipeline hoặc backend tùy contract cuối cùng đã chốt.
8. Backend cập nhật trạng thái để frontend theo dõi.

### Lưu ý kỹ thuật

- flow này không nằm trên realtime path chính
- nếu re-index cần xử lý lại ảnh thì pipeline vẫn nên là lớp đứng trước AI
- có thể làm sync ở bản demo nhỏ
- nếu sau này nặng hơn có thể chuyển sang background job

---

## 10. Luồng debug hoặc test độc lập khi chưa tích hợp đủ service

Đây là luồng hỗ trợ phát triển, không phải luồng nghiệp vụ production.

### Ví dụ 1: Pipeline test với mock AI

1. Chạy mock AI service trong `tools/mock_ai_service/`.
2. Pipeline gửi frame theo đúng contract `pipeline_ai`.
3. Mock AI trả response mẫu.
4. Pipeline tiếp tục test logic lọc trùng và gửi event.

### Ví dụ 2: Pipeline test với mock Backend

1. Chạy mock backend trong `tools/mock_backend_service/`.
2. Pipeline gửi `recognition event` hoặc `unknown event`.
3. Mock backend chỉ log hoặc lưu tạm để xác nhận payload đúng.

### Ví dụ 3: AI test độc lập

1. Dùng ảnh hoặc video trong `tests_shared/fixtures/`.
2. Gọi AI service trực tiếp hoặc chạy script inference riêng.
3. So kết quả với expectation đã thống nhất.

### Ý nghĩa

- team không phải chờ nhau code xong toàn bộ
- contract được kiểm chứng sớm
- lỗi integration được phát hiện sớm hơn

---

## 11. Kết luận

Các luồng của hệ thống đều bám theo nguyên tắc:

- frontend chỉ nói chuyện với backend
- backend giữ business logic và PostgreSQL
- pipeline giữ realtime path và là lớp làm sạch dữ liệu trước AI
- AI service giữ logic inference và Qdrant
- MinIO lưu object, backend giữ metadata nghiệp vụ

Nếu team giữ đúng boundary này, hệ thống sẽ:

- dễ chia việc
- ít conflict
- dễ debug
- dễ nâng cấp từ demo sang production-like hơn
