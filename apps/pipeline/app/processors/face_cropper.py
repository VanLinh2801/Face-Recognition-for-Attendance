import cv2
import numpy as np
import base64
from app.processors.base import BaseProcessor

class FaceCropper(BaseProcessor):
    def __init__(self, output_size=(112, 112)):
        self.output_size = output_size
        # Tọa độ tham chiếu chuẩn của 5 điểm (mắt trái, mắt phải, mũi, mép trái, mép phải)
        # trên ảnh đầu ra kích thước 112x112 (tương thích ArcFace)
        self.reference_pts = np.array([
            [38.2946, 51.6963],
            [73.5318, 51.5014],
            [56.0252, 71.7366],
            [41.5493, 92.3655],
            [70.7299, 92.2041]
        ], dtype=np.float32)

    def process(self, context: dict):
        frame = context.get('frame')
        faces_to_emit = context.get('faces_to_emit', [])
        
        if frame is None or not faces_to_emit:
            return context

        processed_faces = []

        for face in faces_to_emit:
            bbox = face.get('bbox')
            kpss = face.get('kpss')  # Lấy 5 điểm keypoints
            
            if not bbox: continue

            # Nếu có keypoints, thực hiện Face Alignment
            if kpss is not None and len(kpss) == 5:
                src_pts = np.array(kpss, dtype=np.float32)
                # Tính toán ma trận Affine transform
                tform, _ = cv2.estimateAffinePartial2D(src_pts, self.reference_pts, method=cv2.LMEDS)
                
                if tform is not None:
                    # Xoay và cắt ảnh theo ma trận chuẩn
                    crop = cv2.warpAffine(frame, tform, self.output_size, borderValue=0.0)
                else:
                    # Fallback nếu tính toán tform lỗi (rất hiếm)
                    crop = self._simple_crop(frame, bbox)
            else:
                # Fallback nếu không có keypoints
                crop = self._simple_crop(frame, bbox)
            
            if crop is None or crop.size == 0: continue

            # Encode sang Base64
            _, buffer = cv2.imencode('.jpg', crop)
            b64_str = base64.b64encode(buffer).decode('utf-8')
            
            # Tính toán chỉ số hao phí (Loss Ratio) KPI
            orig_w, orig_h = max(1, bbox[2] - bbox[0]), max(1, bbox[3] - bbox[1])
            orig_area = orig_w * orig_h
            processed_area = self.output_size[0] * self.output_size[1]
            loss_ratio = ((processed_area - orig_area) / orig_area) * 100
            
            from app.utils.logger import logger
            logger.debug(f"[KPI] Track {face.get('track_id')}: Crop Loss Ratio: {loss_ratio:.2f}% (Orig: {orig_area:.0f}, New: {processed_area})")

            face['image_b64'] = b64_str
            face['loss_ratio'] = loss_ratio
            processed_faces.append(face)

        context['processed_faces'] = processed_faces
        return context

    def _simple_crop(self, frame, bbox):
        """Crop cơ bản dựa trên bounding box (có padding) khi không có keypoints."""
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = map(int, bbox)
        padding_w = int((x2 - x1) * 0.2)
        padding_h = int((y2 - y1) * 0.2)
        
        x1_p = max(0, x1 - padding_w)
        y1_p = max(0, y1 - padding_h)
        x2_p = min(w, x2 + padding_w)
        y2_p = min(h, y2 + padding_h)

        crop = frame[y1_p:y2_p, x1_p:x2_p]
        if crop.size == 0: return None
        return cv2.resize(crop, self.output_size)
