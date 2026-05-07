from fastapi import FastAPI, BackgroundTasks
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

@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
