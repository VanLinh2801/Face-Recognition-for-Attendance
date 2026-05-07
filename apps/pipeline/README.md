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
ffmpeg -f dshow -i video="Integrated Webcam" -c:v libx264 -preset ultrafast -tune zerolatency -g 10 -f rtsp -rtsp_transport tcp rtsp://localhost:8554/mystream

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