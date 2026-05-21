import time
import uuid
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor
from app.utils.logger import logger
from app.utils.metrics_collector import metrics_collector


class FaceTracker(BaseProcessor):
    def __init__(self):
        # tracks: {track_id: {"last_seen": timestamp, "first_seen": timestamp, "last_snapshot": timestamp,
        #                     "initial_count": int, "passed_photos": int}}
        self.tracks = {}
        self.cooldown = settings.FACE_TRACKER_COOLDOWN
        self.max_age = settings.FACE_TRACKER_MAX_AGE
        self.no_pass_max_age = settings.FACE_TRACKER_NO_PASS_MAX_AGE
        self.max_initial = settings.MAX_INITIAL_SNAPSHOTS
        # {track_id: [frame_sequence_1, frame_sequence_2, ...]} — các frame đã pass quality
        self._filter_passed = {}
        # Track IDs từ frame trước để detect ID switches
        self._previous_track_ids: set = set()

    def process(self, context: dict):
        detections = context.get('detections', [])
        frame = context.get('frame')
        current_time = time.time()
        self._cleanup_tracks(current_time)

        faces_to_emit = []
        current_track_ids = set()
        tracked_for_broadcast = []

        for det in detections:
            bbox = det.get('bbox')
            score = det.get('score')
            kpss = det.get('kpss')

            # Capture prev state TRƯỚC _match_track update centroid
            existing_tid, prev_centroid, prev_time = self._find_track_candidate(bbox)

            # _match_track sẽ update centroid cho track (nếu match)
            track_id = self._match_track(bbox)
            is_new = existing_tid is None

            if is_new:
                x1, y1, x2, y2 = bbox
                self.tracks[track_id] = {
                    "first_seen": current_time,
                    "last_seen": current_time,
                    "last_snapshot": 0.0,
                    "initial_count": 0,
                    "passed_photos": 0,
                    "rejected_photos": 0,
                    "first_rejected_at": None,
                    "centroid": ((x1+x2)/2.0, (y1+y2)/2.0),
                    "velocity": [0.0, 0.0],
                }
                logger.debug(f"[TRACKER] NEW track {track_id}")
            else:
                self.tracks[track_id]["last_seen"] = current_time
                # Tính velocity từ prev đã capture ở trên
                curr = self.tracks[track_id]["centroid"]
                dt = current_time - prev_time
                if dt > 0.01:
                    self.tracks[track_id]["velocity"] = [
                        round((curr[0] - prev_centroid[0]) / dt, 1),
                        round((curr[1] - prev_centroid[1]) / dt, 1),
                    ]
                else:
                    self.tracks[track_id]["velocity"] = [0.0, 0.0]
                # Chỉ broadcast track đã tồn tại ≥1 frame (tránh jitter frame đầu)
                tracked_for_broadcast.append({
                    "track_id": track_id,
                    "bbox": bbox,
                    "score": score,
                    "velocity": self.tracks[track_id]["velocity"],
                })

            current_track_ids.add(track_id)

            track = self.tracks[track_id]

            face_type = None
            if track["passed_photos"] == 0:
                face_type = "NEW"
            elif track["passed_photos"] < self.max_initial:
                face_type = "INITIAL"
            elif (current_time - track["last_snapshot"]) >= self.cooldown:
                face_type = "PERIODIC"

            if face_type:
                faces_to_emit.append({
                    "track_id": track_id,
                    "bbox": bbox,
                    "score": score,
                    "kpss": kpss,
                    "type": face_type
                })

        # Detect ID switches: track mới xuất hiện khi có track cũ active
        for new_tid in current_track_ids:
            if new_tid not in self._previous_track_ids:
                # Track mới - kiểm tra xem có phải switch hay là người mới hoàn toàn
                for old_tid in self._previous_track_ids:
                    if old_tid in self.tracks and old_tid not in current_track_ids:
                        # Track cũ không còn trong frame hiện tại
                        old_track = self.tracks[old_tid]
                        if current_time - old_track.get('last_seen', 0) < self.max_age:
                            # Track cũ vẫn active (chưa expire) nhưng xuất hiện track mới
                            # Kiểm tra khoảng cách centroid
                            if new_tid in self.tracks and old_tid in self.tracks:
                                new_centroid = self.tracks[new_tid].get('centroid', (0, 0))
                                old_centroid = old_track.get('centroid', (0, 0))
                                dist = np.sqrt((new_centroid[0] - old_centroid[0])**2 + (new_centroid[1] - old_centroid[1])**2)
                                if dist < 100:  # Cùng vị trí nhưng ID khác = switch
                                    metrics_collector.record_id_switch()
                                    logger.debug(f"[TRACKER] ID SWITCH: {old_tid} -> {new_tid} (dist={dist:.1f})")

        # Check for expired tracks and record detection-to-send latency
        for old_tid in self._previous_track_ids:
            if old_tid not in current_track_ids and old_tid in self.tracks:
                latency = metrics_collector.check_track_expired(old_tid)
                if latency is not None:
                    logger.debug(f"[DETECTION_LATENCY] track={old_tid} latency_ms={latency:.0f} expired")

        # Update previous track IDs
        self._previous_track_ids = current_track_ids

        # Dọn dẹp các track đã biến mất quá lâu
        self._cleanup_tracks(current_time)

        context['faces_to_emit'] = faces_to_emit
        context['all_tracked_detections'] = tracked_for_broadcast
        return context

    def prune_expired(self):
        self._cleanup_tracks(time.time())

    def sync_filter_passed(self, filter_result: dict):
        """
        Được gọi SAU quality filter.
        filter_result = {track_id: frame_sequence} — track nào pass quality ở frame nào.
        """
        current_time = time.time()
        for track_id in filter_result.keys():
            if track_id in self.tracks:
                track = self.tracks[track_id]
                track["passed_photos"] += 1
                track["initial_count"] += 1
                track["rejected_photos"] = 0
                track["first_rejected_at"] = None
                
                # Update snapshot time for NEW or PERIODIC
                if track["passed_photos"] == 1 or track["passed_photos"] > self.max_initial:
                    track["last_snapshot"] = current_time
                
                logger.debug(f"[TRACKER] {track_id} passed. Total passed={track['passed_photos']}")

    def sync_filter_rejected(self, filter_result: dict):
        current_time = time.time()
        expired_track_ids = []
        for track_id in filter_result.keys():
            if track_id not in self.tracks:
                continue

            track = self.tracks[track_id]
            track["rejected_photos"] = track.get("rejected_photos", 0) + 1
            if track.get("first_rejected_at") is None:
                track["first_rejected_at"] = current_time

            rejected_age = current_time - track["first_rejected_at"]
            if track.get("passed_photos", 0) == 0 and rejected_age >= self.no_pass_max_age:
                expired_track_ids.append(track_id)

        for track_id in expired_track_ids:
            track = self.tracks.pop(track_id, None)
            if track is None:
                continue
            self._previous_track_ids.discard(track_id)
            logger.info(
                "[TRACKER] Dropped no-pass track %s after %.1fs rejected=%s",
                track_id,
                current_time - track.get("first_rejected_at", current_time),
                track.get("rejected_photos", 0),
            )

    def _find_track_candidate(self, bbox):
        """Tìm track candidate gần nhất — không update centroid. Trả về (track_id, prev_centroid, prev_time) hoặc (None, None, None)."""
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        best_track_id = None
        best_prev = None
        best_prev_time = None
        min_dist = float('inf')
        for tid, t_data in self.tracks.items():
            lc = t_data.get('centroid', (0, 0))
            dist = np.sqrt((cx - lc[0])**2 + (cy - lc[1])**2)
            if dist < min_dist and dist < 200.0:
                min_dist = dist
                best_track_id = tid
                best_prev = lc
                best_prev_time = t_data.get('last_seen')
        return best_track_id, best_prev, best_prev_time

    def _match_track(self, bbox):
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        best_track_id = None
        min_dist = float('inf')
        dist_threshold = 200.0

        for tid, t_data in self.tracks.items():
            last_cx, last_cy = t_data.get('centroid', (0, 0))
            dist = np.sqrt((cx - last_cx)**2 + (cy - last_cy)**2)
            if dist < min_dist and dist < dist_threshold:
                min_dist = dist
                best_track_id = tid

        if best_track_id:
            self.tracks[best_track_id]['centroid'] = (cx, cy)
            return best_track_id

        new_id = str(uuid.uuid4())[:8]
        return new_id

    def _cleanup_tracks(self, current_time):
        self.tracks = {tid: t for tid, t in self.tracks.items() if current_time - t["last_seen"] < self.max_age}
