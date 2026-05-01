import cv2
import numpy as np
import onnxruntime as ort
from app.core.config import settings
from app.processors.base import BaseProcessor
from app.utils.logger import logger

def distance2bbox(points, distance, max_shape=None):
    x1 = points[:, 0] - distance[:, 0]
    y1 = points[:, 1] - distance[:, 1]
    x2 = points[:, 0] + distance[:, 2]
    y2 = points[:, 1] + distance[:, 3]
    if max_shape is not None:
        x1 = np.clip(x1, 0, max_shape[1])
        y1 = np.clip(y1, 0, max_shape[0])
        x2 = np.clip(x2, 0, max_shape[1])
        y2 = np.clip(y2, 0, max_shape[0])
    return np.column_stack([x1, y1, x2, y2])

def distance2kps(points, distance, max_shape=None):
    preds = []
    for i in range(0, distance.shape[1], 2):
        px = points[:, i%2] + distance[:, i]
        py = points[:, i%2+1] + distance[:, i+1]
        if max_shape is not None:
            px = np.clip(px, 0, max_shape[1])
            py = np.clip(py, 0, max_shape[0])
        preds.append(px)
        preds.append(py)
    return np.column_stack(preds)

class SCRFDFaceDetector(BaseProcessor):
    def __init__(self):
        self.model_path = settings.SCRFD_MODEL_PATH
        self.threshold = settings.FACE_DETECTION_THRESHOLD
        self.nms_thresh = 0.4
        self.session = None
        self.center_cache = {}
        self._fmc = 3
        self._feat_stride_fpn = [8, 16, 32]
        self._num_anchors = 2
        self._load_model()

    def _load_model(self):
        try:
            import os
            if os.path.exists(self.model_path):
                providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
                self.session = ort.InferenceSession(self.model_path, providers=providers)
                self.input_name = self.session.get_inputs()[0].name
                active_providers = self.session.get_providers()
                logger.info(f"SCRFD Model loaded from {self.model_path}. Active Providers: {active_providers}")
            else:
                logger.warning(f"SCRFD Model file NOT FOUND at {self.model_path}. Running in dummy mode.")
        except Exception as e:
            logger.error(f"Failed to load SCRFD model: {e}")

    def process(self, context: dict):
        frame = context.get('frame')
        if frame is None:
            return context

        detections = []
        if self.session:
            detections = self._run_inference(frame)
        
        context['detections'] = detections
        return context

    def _run_inference(self, img):
        # KHÔNG RESIZE ẢNH - CHỈ THÊM PADDING ĐỂ KÍCH THƯỚC LÀ BỘI SỐ CỦA 32
        h, w = img.shape[:2]
        pad_h = (32 - h % 32) % 32
        pad_w = (32 - w % 32) % 32
        
        if pad_h > 0 or pad_w > 0:
            padded_img = cv2.copyMakeBorder(img, 0, pad_h, 0, pad_w, cv2.BORDER_CONSTANT, value=[0, 0, 0])
        else:
            padded_img = img

        padded_h, padded_w = padded_img.shape[:2]

        # Tiền xử lý
        blob = cv2.dnn.blobFromImage(padded_img, 1.0/128, (padded_w, padded_h), (127.5, 127.5, 127.5), swapRB=True)
        
        # Inference
        net_outs = self.session.run(None, {self.input_name: blob})

        scores_list = []
        bboxes_list = []
        kpss_list = []
        
        # Giải mã đầu ra của SCRFD
        for idx, stride in enumerate(self._feat_stride_fpn):
            scores = net_outs[idx]
            bbox_preds = net_outs[idx + self._fmc]
            kps_preds = net_outs[idx + self._fmc * 2]

            height = padded_h // stride
            width = padded_w // stride
            
            # Sinh Anchors
            key = (height, width, stride)
            if key in self.center_cache:
                anchor_centers = self.center_cache[key]
            else:
                anchor_centers = np.stack(np.mgrid[:height, :width][::-1], axis=-1).astype(np.float32)
                anchor_centers = (anchor_centers * stride).reshape((-1, 2))
                if self._num_anchors > 1:
                    anchor_centers = np.stack([anchor_centers]*self._num_anchors, axis=1).reshape((-1, 2))
                self.center_cache[key] = anchor_centers

            pos_inds = np.where(scores >= self.threshold)[0]
            if len(pos_inds) == 0:
                continue

            bboxes = distance2bbox(anchor_centers[pos_inds], bbox_preds[pos_inds], max_shape=(padded_h, padded_w))
            kpss = distance2kps(anchor_centers[pos_inds], kps_preds[pos_inds], max_shape=(padded_h, padded_w))
            
            scores_list.append(scores[pos_inds])
            bboxes_list.append(bboxes)
            kpss_list.append(kpss)

        if len(scores_list) == 0:
            return []

        scores = np.vstack(scores_list)
        bboxes = np.vstack(bboxes_list)
        kpss = np.vstack(kpss_list)
        
        scores_ravel = scores.ravel()
        order = scores_ravel.argsort()[::-1]
        bboxes = bboxes[order]
        kpss = kpss[order]
        scores = scores[order]

        # NMS
        keep = self._nms(bboxes, scores, self.nms_thresh)
        bboxes = bboxes[keep]
        kpss = kpss[keep]
        scores = scores[keep]

        # Loại bỏ các box nằm hoàn toàn trong phần Padding (nếu có lỗi logic, thường không xảy ra vì pad là viền đen)
        valid_detections = []
        for i in range(len(bboxes)):
            bbox = bboxes[i]
            # Đảm bảo tọa độ không vượt qua ảnh gốc
            x1, y1, x2, y2 = bbox
            x1 = max(0, min(x1, w))
            y1 = max(0, min(y1, h))
            x2 = max(0, min(x2, w))
            y2 = max(0, min(y2, h))
            
            # Nếu bị thu hẹp diện tích về 0 thì bỏ qua
            if x2 <= x1 or y2 <= y1:
                continue
                
            valid_detections.append({
                "bbox": [x1, y1, x2, y2],
                "score": float(scores[i][0]),
                "kpss": kpss[i].reshape((5, 2)).tolist()
            })

        return valid_detections

    def _nms(self, bboxes, scores, thresh):
        x1 = bboxes[:, 0]
        y1 = bboxes[:, 1]
        x2 = bboxes[:, 2]
        y2 = bboxes[:, 3]

        areas = (x2 - x1 + 1) * (y2 - y1 + 1)
        order = scores.ravel().argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1 + 1)
            h = np.maximum(0.0, yy2 - yy1 + 1)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter)

            inds = np.where(ovr <= thresh)[0]
            order = order[inds + 1]

        return keep
