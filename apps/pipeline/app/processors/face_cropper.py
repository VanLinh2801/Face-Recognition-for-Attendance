import cv2
import numpy as np
import base64
from app.processors.base import BaseProcessor

class FaceCropper(BaseProcessor):
    def __init__(self, output_size=(160, 160), scale=2.7):
        self.output_size = output_size
        self.scale = scale

    def process(self, context: dict):
        frame = context.get('frame')
        faces_to_emit = context.get('faces_to_emit', [])
        
        if frame is None or not faces_to_emit:
            return context

        processed_faces = []
        h, w = frame.shape[:2]

        for face in faces_to_emit:
            bbox = face.get('bbox')
            if not bbox: continue

            # 1. Tính toán tâm và kích thước gốc
            x1, y1, x2, y2 = bbox
            fw = x2 - x1
            fh = y2 - y1
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            # 2. Mở rộng box theo scale (mặc định 2.7 cho MiniFASNet)
            # Ta lấy cạnh lớn nhất của mặt để làm chuẩn cho hình vuông
            side = max(fw, fh) * self.scale
            
            # 3. Tính toán tọa độ crop mới
            nx1 = int(cx - side / 2)
            ny1 = int(cy - side / 2)
            nx2 = int(cx + side / 2)
            ny2 = int(cy + side / 2)

            # 4. Xử lý tràn viền (Padding bằng màu đen nếu văng ra ngoài frame)
            # Đây là bước quan trọng để giữ tỉ lệ 1:1 mà không bị méo ảnh
            dx1 = max(0, -nx1)
            dy1 = max(0, -ny1)
            dx2 = max(0, nx2 - w)
            dy2 = max(0, ny2 - h)

            nx1, ny1 = max(0, nx1), max(0, ny1)
            nx2, ny2 = min(w, nx2), min(h, ny2)

            crop = frame[ny1:ny2, nx1:nx2]
            
            if dx1 > 0 or dy1 > 0 or dx2 > 0 or dy2 > 0:
                crop = cv2.copyMakeBorder(crop, dy1, dy2, dx1, dx2, cv2.BORDER_CONSTANT, value=[0, 0, 0])

            # 5. Resize về kích thước chuẩn (160x160) - Dùng INTER_AREA để giữ trung thực khi thu nhỏ
            if crop.shape[0] != self.output_size[0] or crop.shape[1] != self.output_size[1]:
                crop = cv2.resize(crop, self.output_size, interpolation=cv2.INTER_AREA)

            # Encode sang Base64
            _, buffer = cv2.imencode('.jpg', crop)
            b64_str = base64.b64encode(buffer).decode('utf-8')
            
            face['image_b64'] = b64_str
            # Lưu lại metadata để debug
            face['crop_scale'] = self.scale
            processed_faces.append(face)

        context['processed_faces'] = processed_faces
        return context

