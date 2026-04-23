# Hợp đồng giao tiếp giữa service

Thư mục này chứa schema giao tiếp giữa các service trong hệ thống.

- `common/`: schema dùng chung cho mọi message.
- `backend_pipeline/`: event/command do backend gửi sang pipeline.
- `pipeline_ai/`: event/command do pipeline gửi sang AI.
- `pipeline_backend/`: event do pipeline gửi về backend.
- `ai_backend/`: event do AI gửi về backend.

Các contract này là ranh giới tích hợp giữa service. Mỗi service được tự do tổ chức code nội bộ, nhưng khi giao tiếp qua event bus thì phải tuân thủ schema ở đây.

## Boundary hiện tại

- Pipeline sở hữu realtime detection, tracking, quality filtering, spoof/liveness và chuẩn bị face crop.
- AI service sở hữu feature extraction, vector search và indexing.
- Backend sở hữu business state, PostgreSQL và API cho frontend.

## Event đang dùng

- `registration.requested`
- `recognition.requested`
- `frame_analysis.updated`
- `spoof_alert.detected`
- `registration_input.validated`
- `recognition_event.detected`
- `unknown_event.detected`
- `registration_processing.completed`

## Luồng realtime recognition

1. Pipeline đọc frame từ camera hoặc video source.
2. Pipeline detect face, track object, kiểm tra chất lượng và spoof/liveness.
3. Pipeline crop face, upload face crop nếu cần, rồi phát `recognition.requested` sang AI theo `pipeline_ai/recognition_requested.v1.schema.json`.
4. AI extract feature và search vector index.
5. Nếu AI match được người đã đăng ký, AI phát `recognition_event.detected` về backend theo `ai_backend/recognition_event_detected.v1.schema.json`.
6. Nếu AI không match được người đã đăng ký, AI phát `unknown_event.detected` về backend theo `ai_backend/unknown_event_detected.v1.schema.json`.
7. Pipeline phát `frame_analysis.updated` về backend để phục vụ realtime overlay.
8. Nếu pipeline phát hiện spoof/liveness fail, pipeline phát `spoof_alert.detected` về backend.

## Luồng registration

1. Backend phát `registration.requested` sang pipeline theo `backend_pipeline/registration_requested.v1.schema.json`.
2. Pipeline đọc ảnh nguồn, validate ảnh, detect/crop/normalize nếu cần.
3. Pipeline phát `registration_input.validated` về backend để báo ảnh hợp lệ hoặc không hợp lệ.
4. Nếu ảnh hợp lệ, pipeline phát `registration.requested` sang AI theo `pipeline_ai/registration_requested.v1.schema.json`.
5. AI extract feature, index vào vector store, rồi phát `registration_processing.completed` về backend theo `ai_backend/registration_processing_completed.v1.schema.json`.
