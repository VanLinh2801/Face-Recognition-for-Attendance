import time
import uuid
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor

class FaceTracker(BaseProcessor):
    def __init__(self):
        # tracks: {track_id: {"last_seen": timestamp, "first_seen": timestamp, "last_snapshot": timestamp, "initial_count": int}}
        self.tracks = {}
        self.cooldown = settings.FACE_TRACKER_COOLDOWN
        self.max_initial = settings.MAX_INITIAL_SNAPSHOTS

    def process(self, context: dict):
        detections = context.get('detections', [])
        frame = context.get('frame')
        current_time = time.time()
        
        faces_to_emit = []

        # Logic Tracking đơn giản: 
        # Trong thực tế, bạn nên dùng Centroid hoặc Kalman Filter.
        # Ở đây ta sẽ giả định SCRFD trả về detections và ta gán Track ID.
        # (Nếu chưa có Tracker thực sự, ta sẽ tạo ID mới cho mỗi detection để demo)
        
        for det in detections:
            bbox = det.get('bbox')
            score = det.get('score')
            
            # Giả lập tìm kiếm track_id (thực tế sẽ dùng toán học để match)
            track_id = self._match_track(bbox)
            
            if track_id not in self.tracks:
                # 1. Phát hiện mới
                self.tracks[track_id] = {
                    "first_seen": current_time,
                    "last_seen": current_time,
                    "last_snapshot": current_time,
                    "initial_count": 1
                }
                faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "NEW"})
            else:
                track = self.tracks[track_id]
                track["last_seen"] = current_time
                
                # 2. Giai đoạn Initial Burst (3 ảnh trong 2 giây đầu)
                if current_time - track["first_seen"] < 2.0 and track["initial_count"] < self.max_initial:
                    track["initial_count"] += 1
                    faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "INITIAL"})
                
                # 3. Giai đoạn định kỳ (Mỗi 5 phút)
                elif current_time - track["last_snapshot"] >= self.cooldown:
                    track["last_snapshot"] = current_time
                    faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "PERIODIC"})

        # Dọn dẹp các track đã biến mất quá lâu (VD: 10 giây)
        self._cleanup_tracks(current_time)
        
        context['faces_to_emit'] = faces_to_emit
        return context

    def _match_track(self, bbox):
        # Đây là nơi logic Matching (IOU hoặc Centroid) hoạt động.
        # Hiện tại trả về một UUID mới để hoạt động độc lập nếu chưa có tracker xịn.
        return str(uuid.uuid4())[:8]

    def _cleanup_tracks(self, current_time):
        expire_time = 10.0
        self.tracks = {tid: t for tid, t in self.tracks.items() if current_time - t["last_seen"] < expire_time}
