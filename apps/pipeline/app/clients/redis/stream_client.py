import redis
import json
from app.core.config import settings
from app.utils.logger import logger

class RedisStreamClient:
    def __init__(self, url: str = settings.REDIS_URL):
        self.redis = redis.from_url(url, decode_responses=True)

    def send_event(self, stream_key: str, payload: dict):
        """Gửi một event vào Redis Stream dưới dạng JSON."""
        try:
            # Redis Stream yêu cầu dữ liệu dạng key-value
            # Bổ sung maxlen để chống OOM, approximate=True (dấu ~) để tối ưu hiệu suất
            self.redis.xadd(stream_key, {"payload": json.dumps(payload)}, maxlen=10000, approximate=True)
            logger.debug(f"Event sent to stream {stream_key}")
        except Exception as e:
            logger.error(f"Error sending event to Redis Stream: {e}")

    def create_consumer_group(self, stream_key: str, group_name: str):
        """Tạo consumer group nếu chưa tồn tại."""
        try:
            self.redis.xgroup_create(stream_key, group_name, id="0", mkstream=True)
        except redis.exceptions.ResponseError as e:
            if "already exists" not in str(e):
                logger.error(f"Error creating consumer group: {e}")

    def read_events(self, stream_key: str, group_name: str, consumer_name: str, count: int = 10, block: int = 5000):
        """Đọc events từ Redis Stream sử dụng Consumer Group."""
        try:
            # Đọc các tin nhắn mới (">")
            events = self.redis.xreadgroup(group_name, consumer_name, {stream_key: ">"}, count=count, block=block)
            return events
        except Exception as e:
            logger.error(f"Error reading events from Redis Stream: {e}")
            return []

    def ack_event(self, stream_key: str, group_name: str, event_id: str):
        """Xác nhận đã xử lý xong event."""
        try:
            self.redis.xack(stream_key, group_name, event_id)
        except Exception as e:
            logger.error(f"Error acking event: {e}")

redis_stream_client = RedisStreamClient()
