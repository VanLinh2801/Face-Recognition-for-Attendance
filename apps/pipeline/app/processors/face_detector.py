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
            try:
                detections = self._run_inference(frame)
            except Exception as e:
                logger.error(f"[DETECTOR] _run_inference CRASHED: {e}", exc_info=True)
        
        context['detections'] = detections
        return context

    def _run_inference(self, img):
        h, w = img.shape[:2]
        
        # --- Letterbox resize về 640x640 ---
        # Scale để vừa trong 640x640 mà giữ tỷ lệ khung hình
        input_size = 640
        scale = min(input_size / h, input_size / w)
        new_h = int(h * scale)
        new_w = int(w * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        
        # Pad viền phải/dưới để đủ 640x640
        pad_top = 0
        pad_left = 0
        pad_bottom = input_size - new_h
        pad_right  = input_size - new_w
        padded_img = cv2.copyMakeBorder(resized, pad_top, pad_bottom, pad_left, pad_right,
                                         cv2.BORDER_CONSTANT, value=[0, 0, 0])

        padded_h, padded_w = padded_img.shape[:2]  # 640x640
        logger.debug(f"[DETECTOR] Inference info: orig={w}x{h}, scale={scale:.4f}, pads=(t:{pad_top}, l:{pad_left})")

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

            # Reshape về dạng (Anchors, Features) và nhân Stride để ra pixel thực
            scores = scores.reshape(-1, 1)
            bbox_preds = bbox_preds.reshape(-1, 4) * stride
            kps_preds = kps_preds.reshape(-1, 10) * stride

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

        # --- Scale ngược tọa độ từ letterbox space về ảnh gốc ---
        valid_detections = []
        logger.debug(f"[DETECTOR] Total raw detections before filter: {len(bboxes)}")
        for i in range(len(bboxes)):
            x1, y1, x2, y2 = bboxes[i]

            # Bỏ padding rồi chia scale để về tọa độ gốc
            x1 = (x1 - pad_left) / scale
            y1 = (y1 - pad_top) / scale
            x2 = (x2 - pad_left) / scale
            y2 = (y2 - pad_top) / scale

            # Clip vào kích thước ảnh gốc
            x1 = max(0.0, min(x1, w))
            y1 = max(0.0, min(y1, h))
            x2 = max(0.0, min(x2, w))
            y2 = max(0.0, min(y2, h))

            fw = x2 - x1
            fh = y2 - y1
            score = float(scores[i][0])
            logger.debug(f"[DETECTOR] bbox {i}: size={fw:.1f}x{fh:.1f}, score={score:.3f}, pos=({x1:.0f},{y1:.0f})")

            if fw < 40 or fh < 40:
                logger.debug(f"[DETECTOR] --> FILTERED OUT (too small: {fw:.1f}x{fh:.1f})")
                continue

            # Scale keypoints về gốc
            kps = kpss[i].reshape((5, 2))
            kps[:, 0] = (kps[:, 0] - pad_left) / scale
            kps[:, 1] = (kps[:, 1] - pad_top) / scale

            valid_detections.append({
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
                "score": score,
                "kpss": kps.tolist()
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
