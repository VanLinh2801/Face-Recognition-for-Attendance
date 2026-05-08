import time
import uuid
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor
from app.utils.logger import logger

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
                x1, y1, x2, y2 = bbox
                self.tracks[track_id] = {
                    "first_seen": current_time,
                    "last_seen": current_time,
                    "last_snapshot": current_time,
                    "initial_count": 1,
                    "centroid": ((x1+x2)/2.0, (y1+y2)/2.0)
                }
                logger.info(f"[TRACKER] New face detected: {track_id}")
                faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "NEW"})
            else:
                track = self.tracks[track_id]
                track["last_seen"] = current_time
                
                # 2. Giai đoạn Initial Burst (3 ảnh trong 2 giây đầu)
                if current_time - track["first_seen"] < 2.0 and track["initial_count"] < self.max_initial:
                    track["initial_count"] += 1
                    logger.info(f"[TRACKER] Initial burst for {track_id} ({track['initial_count']}/{self.max_initial})")
                    faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "INITIAL"})
                
                # 3. Giai đoạn định kỳ (Mặc định là self.cooldown - 5 phút)
                elif current_time - track["last_snapshot"] >= self.cooldown:
                    track["last_snapshot"] = current_time
                    logger.info(f"[TRACKER] Periodic snapshot for {track_id}")
                    faces_to_emit.append({"track_id": track_id, "bbox": bbox, "score": score, "type": "PERIODIC"})
                else:
                    # Log định kỳ mỗi 30 frame để không spam terminal
                    if int(current_time * 10) % 30 == 0:
                        logger.debug(f"[TRACKER] Face {track_id} is stable, skipping...")

        # Dọn dẹp các track đã biến mất quá lâu (VD: 10 giây)
        self._cleanup_tracks(current_time)
        
        context['faces_to_emit'] = faces_to_emit
        return context

    def _match_track(self, bbox):
        # Tính toán tâm (Centroid) của khuôn mặt mới
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        
        best_track_id = None
        min_dist = float('inf')
        dist_threshold = 200.0 # Tăng lên 200px vì mặt to sát cam di chuyển centroid rất nhanh
        
        # Tìm track gần nhất
        for tid, t_data in self.tracks.items():
            last_cx, last_cy = t_data.get('centroid', (0, 0))
            dist = np.sqrt((cx - last_cx)**2 + (cy - last_cy)**2)
            if dist < min_dist and dist < dist_threshold:
                min_dist = dist
                best_track_id = tid
                
        # Nếu tìm thấy, cập nhật lại tọa độ tâm mới nhất cho track đó
        if best_track_id:
            self.tracks[best_track_id]['centroid'] = (cx, cy)
            return best_track_id
            
        # Nếu không có track nào gần, tạo ID mới
        new_id = str(uuid.uuid4())[:8]
        # (Lưu ý: Centroid sẽ được lưu vào track_data ở hàm process phía trên khi nó thấy ID mới)
        return new_id

    def _cleanup_tracks(self, current_time):
        # 60 giây: đủ để người đứng yên không bị coi là người mới
        # Khi track hết hạn, lần phát hiện tiếp theo sẽ là NEW → upload MinIO
        expire_time = 60.0
        self.tracks = {tid: t for tid, t in self.tracks.items() if current_time - t["last_seen"] < expire_time}
