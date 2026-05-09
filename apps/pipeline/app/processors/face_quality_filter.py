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
        filtered = self._filter_faces(faces)
        context["filtered_faces"] = filtered

        # Feedback cho tracker: track_id → frame_sequence của các face đã pass
        passed_track_ids = {f["track_id"]: context.get("frame_sequence") for f in filtered}
        context["_filter_passed_track_ids"] = passed_track_ids

        return context

    # ------------------------------------------------------------------ #
    # Core filter                                                          #
    # ------------------------------------------------------------------ #

    def _filter_faces(self, faces: list) -> list:
        total = len(faces)
        rejected = []

        # Pre-filter: reject face nhỏ trước để giảm overlap check
        candidates = [f for f in faces if self._check_min_size(f)]

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
        kps = np.array(kpss)
        if kps.shape != (5, 2):
            logger.debug(f"[QUALITY] {face.get('track_id')} missing_kps: shape={kps.shape}")
            return False

        bbox = face.get("bbox")
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
            kps = np.array(kpss)
            if kps.shape != (5, 2):
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
        roll_deg = np.abs(np.degrees(roll_rad))

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
            yaw_deg = yaw_ratio * 90.0

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

        return reasons
