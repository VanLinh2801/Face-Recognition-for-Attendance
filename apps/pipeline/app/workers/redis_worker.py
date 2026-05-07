import asyncio
import json
from app.clients.redis.stream_client import redis_stream_client
from app.services.pipeline_service import pipeline_service
from app.core.config import settings
from app.utils.logger import logger

class RedisWorker:
    def __init__(self):
        self.stream_key = settings.STREAM_REGISTRATION_REQ
        self.group_name = "pipeline-group"
        self.consumer_name = f"pipeline-consumer-{settings.APP_NAME}"

    async def start(self):
        logger.info(f"Starting Redis Worker listening on {self.stream_key}...")
        
        # 1. Tạo Consumer Group
        await redis_stream_client.create_consumer_group(self.stream_key, self.group_name)

        # 2. Vòng lặp lắng nghe
        while True:
            try:
                # Đọc event từ stream
                events = await redis_stream_client.read_events(self.stream_key, self.group_name, self.consumer_name)
                
                for stream, messages in events:
                    for msg_id, data in messages:
                        envelope_str = data.get("envelope")
                        if envelope_str:
                            try:
                                envelope = json.loads(envelope_str)
                                logger.info(f"Received event: {envelope.get('event_name')} from {envelope.get('producer')}")
                                
                                # Xử lý dựa trên event_name
                                event_name = envelope.get("event_name")
                                if event_name == "registration.requested":
                                    await pipeline_service.handle_registration(envelope)
                                else:
                                    logger.warning(f"Unhandled event type: {event_name}")
                            except Exception as e:
                                logger.error(f"Error parsing envelope: {e}")
                            
                        # Xác nhận đã xử lý
                        await redis_stream_client.ack_event(self.stream_key, self.group_name, msg_id)
                
                await asyncio.sleep(0.1) # Tránh chiếm dụng CPU
            except Exception as e:
                logger.error(f"Error in Redis Worker: {e}")
                await asyncio.sleep(1)

redis_worker = RedisWorker()
