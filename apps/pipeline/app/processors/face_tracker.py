import time
import uuid
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor
from app.utils.logger import logger


class FaceTracker(BaseProcessor):
    def __init__(self):
        # tracks: {track_id: {"last_seen": timestamp, "first_seen": timestamp, "last_snapshot": timestamp,
        #                     "initial_count": int, "passed_photos": int}}
        self.tracks = {}
        self.cooldown = settings.FACE_TRACKER_COOLDOWN
        self.max_age = settings.FACE_TRACKER_MAX_AGE
        self.max_initial = settings.MAX_INITIAL_SNAPSHOTS
        # {track_id: [frame_sequence_1, frame_sequence_2, ...]} — các frame đã pass quality
        self._filter_passed = {}

    def process(self, context: dict):
        detections = context.get('detections', [])
        frame = context.get('frame')
        current_time = time.time()

        faces_to_emit = []

        for det in detections:
            bbox = det.get('bbox')
            score = det.get('score')
            kpss = det.get('kpss')

            track_id = self._match_track(bbox)
            is_new = track_id not in self.tracks

            if is_new:
                x1, y1, x2, y2 = bbox
                self.tracks[track_id] = {
                    "first_seen": current_time,
                    "last_seen": current_time,
                    "last_snapshot": 0.0,
                    "initial_count": 0,
                    "passed_photos": 0,
                    "centroid": ((x1+x2)/2.0, (y1+y2)/2.0)
                }
                logger.debug(f"[TRACKER] NEW track {track_id}")
            else:
                self.tracks[track_id]["last_seen"] = current_time

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

        # Dọn dẹp các track đã biến mất quá lâu
        self._cleanup_tracks(current_time)

        context['faces_to_emit'] = faces_to_emit
        return context

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
                
                # Update snapshot time for NEW or PERIODIC
                if track["passed_photos"] == 1 or track["passed_photos"] > self.max_initial:
                    track["last_snapshot"] = current_time
                
                logger.debug(f"[TRACKER] {track_id} passed. Total passed={track['passed_photos']}")

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
