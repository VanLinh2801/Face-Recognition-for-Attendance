import redis.asyncio as redis
import json
from app.core.config import settings
from app.utils.logger import logger

class RedisStreamClient:
    def __init__(self, url: str = settings.REDIS_URL):
        self.redis = redis.from_url(url, decode_responses=True)

    async def send_event(self, stream_key: str, payload: dict):
        """Gửi một event vào Redis Stream dưới dạng JSON (Async)."""
        try:
            # Redis Stream yêu cầu dữ liệu dạng key-value
            await self.redis.xadd(stream_key, {"envelope": json.dumps(payload)}, maxlen=10000, approximate=True)
            logger.debug(f"Event sent to stream {stream_key}")
        except Exception as e:
            logger.error(f"Error sending event to Redis Stream: {e}")

    async def create_consumer_group(self, stream_key: str, group_name: str):
        """Tạo consumer group nếu chưa tồn tại (Async)."""
        try:
            await self.redis.xgroup_create(stream_key, group_name, id="0", mkstream=True)
        except Exception as e:
            if "already exists" not in str(e):
                logger.error(f"Error creating consumer group: {e}")

    async def read_events(self, stream_key: str, group_name: str, consumer_name: str, count: int = 10, block: int = 5000):
        """Đọc events sử dụng Consumer Group (Async)."""
        try:
            events = await self.redis.xreadgroup(group_name, consumer_name, {stream_key: ">"}, count=count, block=block)
            return events
        except Exception as e:
            logger.error(f"Error reading events from Redis Stream: {e}")
            return []

    async def ack_event(self, stream_key: str, group_name: str, event_id: str):
        """Xác nhận đã xử lý xong event (Async)."""
        try:
            await self.redis.xack(stream_key, group_name, event_id)
        except Exception as e:
            logger.error(f"Error acking event: {e}")

    async def close(self):
        await self.redis.close()

redis_stream_client = RedisStreamClient()
