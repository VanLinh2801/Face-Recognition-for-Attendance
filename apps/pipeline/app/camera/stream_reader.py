import cv2
import time
from app.utils.logger import logger

class StreamReader:
    def __init__(self, source: str):
        # source có thể là ID webcam (0, 1) hoặc URL RTSP
        try:
            self.source = int(source)
        except ValueError:
            self.source = source
            
        self.cap = None

    def connect(self):
        # Ép sử dụng giao thức TCP cho RTSP để ổn định luồng, tránh mất gói tin (UDP)
        if isinstance(self.source, str) and self.source.startswith("rtsp"):
            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
        else:
            self.cap = cv2.VideoCapture(self.source)

        if not self.cap.isOpened():
            logger.error(f"Failed to open camera source: {self.source}")
            return False
        logger.info(f"Successfully connected to camera: {self.source}")
        return True

    def read_frame(self):
        if self.cap is None or not self.cap.isOpened():
            if not self.connect():
                return None
        
        ret, frame = self.cap.read()
        if not ret:
            logger.warning(f"Failed to read frame from source: {self.source}. Reconnecting...")
            self.connect()
            return None
            
        return frame

    def release(self):
        if self.cap:
            self.cap.release()
            logger.info(f"Released camera source: {self.source}")
