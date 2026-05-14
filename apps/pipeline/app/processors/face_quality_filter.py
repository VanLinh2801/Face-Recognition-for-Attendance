import cv2
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor
from app.utils.logger import logger


class FaceQualityFilter(BaseProcessor):
    """
    Hard filter: face fail bất kỳ check nào → không gửi lên ai_service.

    Checks:
        1. MIN_FACE_SIZE_PX  — cạnh nhỏ nhất của SCRFD bbox phải >= threshold
        2. SINGLE_FACE       — IoU giữa 2 bbox > 0.5 → reject face nhỏ hơn
        3. FULL_5_KPS        — đủ 5 keypoints, không out-of-bbox, không trùng nhau
        4. FACE_COMPLETENESS — face không bị cắt bởi viền frame
        5. FACE_ANGLE        — góc nghiêng yaw <= 45° (3/4 face)
    """

    def __init__(self):
        self.min_face_size = settings.MIN_FACE_SIZE_PX
        self.require_full_kps = settings.REQUIRE_FULL_KPS
        self.min_kps_dist = settings.MIN_KPS_DIST_PX
        self.overlap_iou_threshold = settings.FACE_OVERLAP_IOU_THRESHOLD
        self.max_yaw_deg = settings.MAX_FACE_YAW_DEG
        self.min_sharpness = settings.MIN_FACE_SHARPNESS

    def process(self, context: dict):
        faces = context.get("faces_to_emit", [])
        if not faces:
            context["filtered_faces"] = []
            return context

        # Inject frame dimensions vào mỗi face để check completeness
        frame_w = context.get("frame_width")
        frame_h = context.get("frame_height")
        for face in faces:
            if "_frame_width" not in face:
                face["_frame_width"] = frame_w
            if "_frame_height" not in face:
                face["_frame_height"] = frame_h

        # Luôn giữ nguyên detections gốc để check overlap giữa các face
        frame = context.get("frame")
        filtered = self._filter_faces(faces, frame)
        context["filtered_faces"] = filtered

        # Feedback cho tracker: track_id → frame_sequence của các face đã pass
        passed_track_ids = {f["track_id"]: context.get("frame_sequence") for f in filtered}
        context["_filter_passed_track_ids"] = passed_track_ids

        return context

    # ------------------------------------------------------------------ #
    # Core filter                                                          #
    # ------------------------------------------------------------------ #

    def _filter_faces(self, faces: list, frame=None) -> list:
        total = len(faces)
        rejected = []

        # Pre-filter: reject face nhỏ trước để giảm overlap check
        candidates = [f for f in faces if self._check_min_size(f)]

        # Check 2: SHARPNESS — reject face bị mờ
        if frame is not None:
            candidates = [f for f in candidates if self._check_sharpness(f, frame)]

        # Check 3: FULL_5_KPS — reject face thiếu/invalid 5 keypoints
        candidates = [f for f in candidates if self._check_full_kps(f)]

        # Check 4: FACE_COMPLETENESS — face không bị cắt bởi viền frame
        candidates = [f for f in candidates if self._check_face_completeness(f)]

        # Check 5: FACE_ANGLE — góc nghiêng yaw <= 45°
        candidates = [f for f in candidates if self._check_face_angle(f)]

        # Overlap check: nếu 2 bbox IoU > threshold → reject face nhỏ hơn
        survivors = self._resolve_overlaps(candidates)

        for face in faces:
            if face in survivors:
                continue

            if face not in candidates:
                reasons = self._collect_reasons(face)
                logger.warning(
                    f"[QUALITY] REJECTED {face.get('track_id', '?')} | "
                    f"type={face.get('type', '?')} | reasons=[{', '.join(reasons)}]"
                )
                rejected.append(face)
            else:
                # Candidate nhưng bị overlap reject
                reasons = self._collect_reasons(face)
                reasons.append("overlap_iou")
                logger.warning(
                    f"[QUALITY] REJECTED {face.get('track_id', '?')} | "
                    f"type={face.get('type', '?')} | reasons=[{', '.join(reasons)}]"
                )
                rejected.append(face)

        passed = survivors
        logger.info(
            f"[QUALITY] {len(passed)}/{total} faces passed | "
            f"rejected={len(rejected)} | "
            f"min_size={self.min_face_size}px"
        )
        return passed

    # ------------------------------------------------------------------ #
    # Check 1: MIN_FACE_SIZE_PX                                           #
    # ------------------------------------------------------------------ #

    def _check_min_size(self, face: dict) -> bool:
        bbox = face.get("bbox")
        if not bbox or len(bbox) != 4:
            return False
        x1, y1, x2, y2 = bbox
        fw = float(x2 - x1)
        fh = float(y2 - y1)
        face["_quality_face_width"] = fw
        face["_quality_face_height"] = fh
        face["_quality_side"] = min(fw, fh)
        face["_quality_crop_area"] = int((min(fw, fh) * 2.7) ** 2)
        return face["_quality_side"] >= self.min_face_size

    # ------------------------------------------------------------------ #
    # Check 1.5: SHARPNESS (Variance of Laplacian)                       #
    # ------------------------------------------------------------------ #

    def _check_sharpness(self, face: dict, frame) -> bool:
        bbox = face.get("bbox")
        if not bbox or frame is None:
            return False

        x1, y1, x2, y2 = [int(v) for v in bbox]
        fh, fw = frame.shape[:2]

        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(fw, x2), min(fh, y2)

        if x2 <= x1 or y2 <= y1:
            return False

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return False

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        face["_quality_sharpness"] = float(sharpness)

        if sharpness < self.min_sharpness:
            logger.debug(f"[QUALITY] {face.get('track_id')} blurry: sharpness={sharpness:.1f} < {self.min_sharpness}")
            return False
            
        return True

    # ------------------------------------------------------------------ #
    # Check 2: SINGLE_FACE — IoU overlap                                 #
    # ------------------------------------------------------------------ #

    def _resolve_overlaps(self, faces: list) -> list:
        """
        Với mỗi cặp bbox IoU > threshold, giữ lại face có bbox lớn hơn.
        Face nhỏ hơn bị remove khỏi survivors.
        """
        survivors = {f["track_id"]: f for f in faces}  # track_id → face

        to_remove = set()
        n = len(faces)
        for i in range(n):
            for j in range(i + 1, n):
                fi, fj = faces[i], faces[j]
                if fi["track_id"] in to_remove or fj["track_id"] in to_remove:
                    continue

                iou = self._iou(fi["bbox"], fj["bbox"])
                if iou > self.overlap_iou_threshold:
                    area_i = fi["_quality_side"] ** 2
                    area_j = fj["_quality_side"] ** 2
                    if area_i >= area_j:
                        to_remove.add(fj["track_id"])
                        logger.debug(
                            f"[QUALITY] Overlap IoU={iou:.3f} — "
                            f"REJECT smaller {fj['track_id']} (kept {fi['track_id']})"
                        )
                    else:
                        to_remove.add(fi["track_id"])
                        logger.debug(
                            f"[QUALITY] Overlap IoU={iou:.3f} — "
                            f"REJECT smaller {fi['track_id']} (kept {fj['track_id']})"
                        )

        for tid in to_remove:
            survivors.pop(tid, None)

        return list(survivors.values())

    @staticmethod
    def _iou(bbox_a, bbox_b) -> float:
        x1a, y1a, x2a, y2a = bbox_a
        x1b, y1b, x2b, y2b = bbox_b
        xi1 = max(x1a, x1b)
        yi1 = max(y1a, y1b)
        xi2 = min(x2a, x2b)
        yi2 = min(y2a, y2b)
        inter = max(0.0, xi2 - xi1) * max(0.0, yi2 - yi1)
        area_a = (x2a - x1a) * (y2a - y1a)
        area_b = (x2b - x1b) * (y2b - y1b)
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    # ------------------------------------------------------------------ #
    # Check 3: FULL_5_KPS                                                 #
    # ------------------------------------------------------------------ #

    def _check_full_kps(self, face: dict) -> bool:
        if not self.require_full_kps:
            return True
        kpss = face.get("kpss")
        if kpss is None:
            logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: kpss=None")
            return False
        try:
            kps = np.asarray(kpss, dtype=np.float32)
        except (ValueError, TypeError):
            logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: invalid kpss={kpss}")
            return False

        if kps.shape != (5, 2):
            logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: shape={kps.shape}")
            return False
        if not np.isfinite(kps).all():
            logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: non_finite kpss={kpss}")
            return False

        bbox = face.get("bbox")
        if not bbox or len(bbox) != 4:
            return False
        x1, y1, x2, y2 = bbox

        for idx, kp in enumerate(kps):
            kx, ky = kp
            if kx < x1 or kx > x2 or ky < y1 or ky > y2:
                logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: kp[{idx}]=({kx:.1f},{ky:.1f}) out of bbox [{x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f}]")
                return False

        for i in range(5):
            for j in range(i + 1, 5):
                dist = np.linalg.norm(kps[i] - kps[j])
                if dist < self.min_kps_dist:
                    logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: dist({i},{j})={dist:.1f} < {self.min_kps_dist}")
                    return False

        if not self._check_kps_geometry(face, kps):
            return False

        return True

    def _check_kps_geometry(self, face: dict, kps: np.ndarray) -> bool:
        left_eye, right_eye, nose, mouth_left, mouth_right = kps
        bbox = face.get("bbox")
        x1, y1, x2, y2 = bbox
        bw = float(x2 - x1)
        bh = float(y2 - y1)
        if bw <= 0 or bh <= 0:
            return False

        eye_dist = float(np.linalg.norm(right_eye - left_eye))
        min_eye_dist = max(self.min_kps_dist * 2.0, bw * 0.12)
        if eye_dist < min_eye_dist:
            logger.debug(
                f"[QUALITY] {face.get('track_id')} invalid_kps_geometry: "
                f"eye_dist={eye_dist:.1f} < {min_eye_dist:.1f}"
            )
            return False

        if left_eye[0] >= right_eye[0] or mouth_left[0] >= mouth_right[0]:
            logger.debug(f"[QUALITY] {face.get('track_id')} invalid_kps_geometry: left/right order")
            return False

        eye_y = (left_eye[1] + right_eye[1]) / 2.0
        mouth_y = (mouth_left[1] + mouth_right[1]) / 2.0
        if not (eye_y < nose[1] < mouth_y):
            logger.debug(
                f"[QUALITY] {face.get('track_id')} invalid_kps_geometry: "
                f"eye_y={eye_y:.1f}, nose_y={nose[1]:.1f}, mouth_y={mouth_y:.1f}"
            )
            return False

        return True

    # ------------------------------------------------------------------ #
    # Check 4: FACE_COMPLETENESS                                          #
    # ------------------------------------------------------------------ #

    def _check_face_completeness(self, face: dict) -> bool:
        """
        Kiểm tra face không bị cắt bởi viền frame.
        Yêu cầu: tất cả 4 góc của bbox phải nằm trong frame.
        """
        bbox = face.get("bbox")
        if not bbox or len(bbox) != 4:
            return False

        x1, y1, x2, y2 = bbox

        # Lấy kích thước frame từ context (được set bởi frame grabber)
        frame_w = face.get("_frame_width")
        frame_h = face.get("_frame_height")

        if frame_w is None or frame_h is None:
            # Nếu không có thông tin frame, skip check này
            return True

        # Check: bbox phải nằm hoàn toàn trong frame
        if x1 < 0 or y1 < 0 or x2 > frame_w or y2 > frame_h:
            return False

        # Check margin nhỏ: đảm bảo face không quá sát viền
        # (có thể bị cắt một phần nhỏ)
        margin = 5  # pixel
        if x1 < margin or y1 < margin or (frame_w - x2) < margin or (frame_h - y2) < margin:
            return False

        return True

    # ------------------------------------------------------------------ #
    # Check 5: FACE_ANGLE (yaw)                                          #
    # ------------------------------------------------------------------ #

    def _check_face_angle(self, face: dict) -> bool:
        """
        Kiểm tra góc nghiêng của face (yaw và roll) từ 5 KPS.
        - Roll (nghiêng đầu về phía vai): atan2(dy, dx) của 2 mắt.
        - Yaw (quay mặt sang trái/phải): tỷ lệ hình chiếu của mũi lên trục nối 2 mắt.
        Giới hạn: yaw và roll đều <= max_yaw_deg (mặc định 45°)
        """
        kpss = face.get("kpss")
        if kpss is None:
            return False

        try:
            kps = np.asarray(kpss, dtype=np.float32)
            if kps.shape != (5, 2):
                return False
            if not np.isfinite(kps).all():
                return False
        except (ValueError, TypeError):
            return False

        # KPS index: 0=left_eye, 1=right_eye, 2=nose, 3=mouth_left, 4=mouth_right
        left_eye = kps[0]
        right_eye = kps[1]
        nose = kps[2]

        # 1. Tính ROLL (nghiêng đầu trái/phải)
        eye_vector = right_eye - left_eye
        dx = eye_vector[0]
        dy = eye_vector[1]
        roll_rad = np.arctan2(dy, dx)
        roll_deg = abs(float(np.degrees(roll_rad)))
        if roll_deg > 90.0:
            roll_deg = 180.0 - roll_deg

        # 2. Tính YAW (quay mặt trái/phải)
        L = np.linalg.norm(eye_vector)
        if L < 1e-5:
            yaw_deg = 90.0
        else:
            u = eye_vector / L
            W = nose - left_eye
            p = np.dot(W, u)
            # Tỷ lệ: p lệch khỏi tâm L/2 bao nhiêu phần trăm so với L/2
            yaw_ratio = np.abs(2 * p - L) / L
            yaw_deg = min(float(yaw_ratio * 90.0), 90.0)

        # Lưu lại để debug/log
        face["_quality_yaw_deg"] = float(yaw_deg)
        face["_quality_roll_deg"] = float(roll_deg)

        return yaw_deg <= self.max_yaw_deg and roll_deg <= self.max_yaw_deg

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _collect_reasons(self, face: dict) -> list:
        reasons = []
        bbox = face.get("bbox")
        if not bbox:
            reasons.append("no_bbox")
            return reasons

        side = min(float(bbox[2] - bbox[0]), float(bbox[3] - bbox[1]))
        if side < self.min_face_size:
            reasons.append(f"min_size({side:.0f}px<{self.min_face_size}px)")

        if not self._check_full_kps(face):
            reasons.append("missing_kps")

        if not self._check_face_completeness(face):
            reasons.append("face_cut_by_frame")

        yaw_deg = face.get("_quality_yaw_deg")
        if yaw_deg is not None and yaw_deg > self.max_yaw_deg:
            reasons.append(f"yaw_angle({yaw_deg:.1f}°>{self.max_yaw_deg}°)")

        roll_deg = face.get("_quality_roll_deg")
        if roll_deg is not None and roll_deg > self.max_yaw_deg:
            reasons.append(f"roll_angle({roll_deg:.1f}°>{self.max_yaw_deg}°)")

        sharpness = face.get("_quality_sharpness")
        if sharpness is not None and sharpness < self.min_sharpness:
            reasons.append(f"sharpness({sharpness:.1f}<{self.min_sharpness})")

        detail = self._format_quality_detail(face)
        if detail:
            reasons.append(detail)

        return reasons

    def _format_quality_detail(self, face: dict) -> str:
        bbox = face.get("bbox")
        parts = []
        if bbox and len(bbox) == 4:
            x1, y1, x2, y2 = [float(v) for v in bbox]
            parts.append(f"bbox=({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
            parts.append(f"side={min(x2 - x1, y2 - y1):.0f}px")

        yaw_deg = face.get("_quality_yaw_deg")
        roll_deg = face.get("_quality_roll_deg")
        if yaw_deg is not None:
            parts.append(f"yaw={yaw_deg:.1f}")
        if roll_deg is not None:
            parts.append(f"roll={roll_deg:.1f}")

        sharpness = face.get("_quality_sharpness")
        if sharpness is not None:
            parts.append(f"sharpness={sharpness:.1f}")

        kpss = face.get("kpss")
        if kpss is not None:
            try:
                kps = np.asarray(kpss, dtype=np.float32)
                if kps.shape == (5, 2):
                    compact = ";".join(f"{x:.0f},{y:.0f}" for x, y in kps)
                    parts.append(f"kps=[{compact}]")
            except (ValueError, TypeError):
                parts.append("kps=invalid")

        return "debug(" + " ".join(parts) + ")" if parts else ""
