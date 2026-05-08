import cv2
import time
import threading
from app.utils.logger import logger


class StreamReader:
    """
    Đọc RTSP/Camera bằng background thread riêng.
    
    Vấn đề với cap.read() trực tiếp trong asyncio:
    - OpenCV buffer nhiều frame → đọc nhiều lần liên tiếp → frame giống nhau → motion_ratio = 0
    
    Giải pháp: Background thread liên tục gọi cap.read() để XẢ BUFFER,
    chỉ lưu lại frame MỚI NHẤT. Main loop lấy frame từ biến shared.
    """

    def __init__(self, source: str):
        try:
            self.source = int(source)
        except ValueError:
            self.source = source

        self.cap = None
        self._latest_frame = None
        self._lock = threading.Lock()
        self._thread = None
        self._running = False
        self._connected = False
        self._frame_count = 0
        self._fps_start = time.time()

    def connect(self) -> bool:
        """Mở kết nối và khởi động background reader thread."""
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
        self._connected = True
        self._running = True

        # Khởi động background thread xả buffer
        self._thread = threading.Thread(
            target=self._reader_loop,
            name=f"StreamReader-{self.source}",
            daemon=True
        )
        self._thread.start()
        logger.info(f"Background reader thread started for: {self.source}")
        return True

    def _reader_loop(self):
        """
        Background thread: liên tục đọc và xả buffer RTSP.
        Chỉ lưu lại frame mới nhất vào self._latest_frame.
        """
        reconnect_delay = 1.0
        while self._running:
            if self.cap is None or not self.cap.isOpened():
                logger.warning(f"Stream disconnected, reconnecting in {reconnect_delay}s...")
                time.sleep(reconnect_delay)
                self._reconnect()
                continue

            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self._lock:
                    self._latest_frame = frame
                self._frame_count += 1

                if self._frame_count % 100 == 0:
                    pass

                # self._frame_count += 1 (keeping count but removing logs)
                self._frame_count += 1
            else:
                logger.warning(f"Failed to read frame from: {self.source}")
                time.sleep(0.1)

    def _reconnect(self):
        """Thử kết nối lại."""
        if self.cap:
            self.cap.release()
        if isinstance(self.source, str) and self.source.startswith("rtsp"):
            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
        else:
            self.cap = cv2.VideoCapture(self.source)

        if self.cap.isOpened():
            logger.info(f"Reconnected to: {self.source}")
        else:
            logger.error(f"Reconnect failed for: {self.source}")

    def read_frame(self):
        """
        Trả về frame MỚI NHẤT (non-blocking).
        Được gọi từ main loop / asyncio.to_thread.
        """
        with self._lock:
            if self._latest_frame is None:
                return None
            # Trả bản copy để tránh race condition
            return self._latest_frame.copy()

    def release(self):
        """Dừng thread và giải phóng tài nguyên."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        if self.cap:
            self.cap.release()
        logger.info(f"Released camera source: {self.source}")
