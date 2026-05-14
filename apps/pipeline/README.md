# Hướng dẫn tạo luồng RTSP (Giả lập Camera)

Tài liệu này hướng dẫn cách sử dụng `ffmpeg` để đẩy luồng hình ảnh từ Webcam laptop hoặc từ một file Video có sẵn lên MediaMTX Server. 
Từ đó, Pipeline của chúng ta có thể đọc RTSP stream giống y hệt như đang đọc từ một chiếc Camera IP thực tế.

> [!IMPORTANT]
> **Yêu cầu bắt buộc**: Bạn phải đảm bảo container `mediamtx` đang chạy (thông qua lệnh `docker-compose up -d mediamtx` ở thư mục gốc) trước khi chạy các lệnh dưới đây.

---

## 1. Quét tìm tên thiết bị (Webcam) trên máy tính

Trên Windows, để biết tên chính xác của Webcam đang cắm vào máy, bạn chạy lệnh sau trong Terminal/Command Prompt:

```bash
ffmpeg -list_devices true -f dshow -i dummy
```

*Kết quả trả về sẽ liệt kê danh sách các thiết bị "DirectShow video devices". Hãy copy đúng cái tên nằm trong ngoặc kép (Ví dụ: `"Integrated Webcam"` hoặc `"USB Video Device"`).*

---

## 2. Cách 1: Phát trực tiếp từ Webcam Laptop lên RTSP

Thay thế `"Integrated Webcam"` bằng tên thiết bị bạn vừa quét được ở bước 1.

```bash
ffmpeg -f dshow -rtbufsize 100M -thread_queue_size 512 -i video="Integrated Webcam" `
-c:v h264_mf -b:v 800k -fpsmax 10 `
-f rtsp -rtsp_transport tcp rtsp://localhost:8554/mystream
```

**Giải thích thông số:**
*   `-f dshow`: Dùng DirectShow của Windows để đọc thiết bị.
*   `-rtbufsize 500M`: Tăng bộ nhớ đệm để tránh giật/rớt khung hình.
*   `-preset ultrafast -tune zerolatency`: Ép FFmpeg nén video nhanh nhất có thể để đạt độ trễ (latency) bằng 0.
*   `rtsp://localhost:8554/mystream`: Đường dẫn đích trên server MediaMTX.

---

## 3. Cách 2: Phát lặp lại (Loop) từ một file Video có sẵn

Nếu bạn có một file video (ví dụ `test_video.mp4`) chứa cảnh người đi lại và muốn dùng nó để test hệ thống liên tục mà không cần ngồi trước webcam:

```bash
ffmpeg -re -stream_loop -1 -i test_video.mp4 -c:v libx264 -preset ultrafast -tune zerolatency -rtsp_transport tcp -f rtsp rtsp://localhost:8554/mystream
```

**Giải thích thông số:**
*   `-re`: Đọc file video đúng với tốc độ gốc (Native framerate). Nếu không có cờ này, FFmpeg sẽ đọc và ném rác lên server với tốc độ bàn thờ.
*   `-stream_loop -1`: Lặp lại video vô tận (Hết video tự động phát lại từ đầu).

---

## 4. Cấu hình Pipeline để đọc luồng này

Sau khi chạy 1 trong 2 lệnh trên thành công (Terminal sẽ hiện thông số bitrate chạy liên tục), bạn vào file `.env` của thư mục `pipeline` và sửa cấu hình:

```env
# Đọc luồng RTSP vừa được tạo ra
CAMERA_SOURCES=rtsp://localhost:8554/mystream
```

Sau đó khởi động Pipeline: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

---

## 5. Khởi tạo Consumer Groups cho Redis

Hệ thống sử dụng Redis Streams để giao tiếp giữa các dịch vụ. Bạn cần khởi tạo các "Consumer Group" để các dịch vụ có thể nhận dữ liệu.

### Nếu chạy với Docker:
Mở một Terminal mới tại thư mục gốc của dự án và chạy 2 lệnh sau (đảm bảo container `redis` đang chạy):

```bash
# Tạo group cho Backend nhận kết quả từ AI Service
docker compose exec redis redis-cli XGROUP CREATE ai_backend backend-consumers $ MKSTREAM

# Tạo group cho AI Service nhận dữ liệu từ Pipeline
docker compose exec redis redis-cli XGROUP CREATE pipeline_ai ai-consumers $ MKSTREAM
```

### Nếu chạy local (không dùng Docker):
Chạy file script đã chuẩn bị sẵn ở thư mục gốc:
```bash
.\setup_redis_groups.bat
```

> [!NOTE]
> Bạn chỉ cần chạy lệnh này **một lần duy nhất** khi thiết lập hệ thống lần đầu hoặc sau khi xóa volume của Redis. Nếu Group đã tồn tại, lệnh sẽ báo lỗi `BUSYGROUP` - bạn có thể bỏ qua lỗi này.

### 6. Kiểm tra ảnh từ pipeline gửi đến ai_service
```bash
python debug_face_image.py listen
```