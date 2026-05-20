from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.camera.manager import CameraManager
from app.services.pipeline_service import pipeline_service
from app.utils.logger import logger
import asyncio

from contextlib import asynccontextmanager

camera_manager = CameraManager(process_callback=pipeline_service.handle_realtime_frame)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Initializing Pipeline Service...")
    from app.workers.redis_worker import redis_worker
    asyncio.create_task(camera_manager.start_all())
    asyncio.create_task(redis_worker.start())
    yield
    # Shutdown logic
    logger.info("Shutting down Pipeline Service...")
    await camera_manager.stop_all()

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Add CORS middleware to allow WebSocket connections from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


@app.websocket("/ws/bbox")
async def bbox_ws_endpoint(websocket: WebSocket):
    from app.websocket.bbox_broadcaster import bbox_broadcaster
    try:
        await bbox_broadcaster.connect(websocket)
        logger.info("[WS_BBOX] New client connected, total clients: %d", len(bbox_broadcaster._clients))
        try:
            while True:
                # Keep the connection alive by receiving messages (if any)
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
        except asyncio.TimeoutError:
            # Connection timeout, client might be idle - disconnect
            await bbox_broadcaster.disconnect(websocket)
            logger.info("[WS_BBOX] Client idle timeout, disconnected")
    except Exception as e:
        logger.error(f"[WS_BBOX] Connection error: {e}", exc_info=True)
        try:
            await websocket.close(code=1000)
        except:
            pass
        if websocket in bbox_broadcaster._clients:
            await bbox_broadcaster.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
