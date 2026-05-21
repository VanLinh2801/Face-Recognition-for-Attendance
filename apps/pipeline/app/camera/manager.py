import asyncio
from app.camera.stream_reader import StreamReader
from app.core.config import settings
from app.utils.logger import logger
from typing import List, Callable

class CameraManager:
    def __init__(self, process_callback: Callable):
        # process_callback là hàm xử lý frame được nhận từ service
        self.sources = [s.strip() for s in settings.CAMERA_SOURCES.split(",")]
        self.is_running = False
        self.tasks: List[asyncio.Task] = []
        self.process_callback = process_callback

    async def _camera_loop(self, source: str):
        reader = StreamReader(source)
        processing_task: asyncio.Task | None = None
        logger.info(f"Starting loop for camera: {source}")
        
        # Thử kết nối ban đầu, nếu lỗi thì tiếp tục thử lại thay vì return (Auto-reconnect)
        while self.is_running and not reader.connect():
            logger.warning(f"Initial connection to {source} failed. Retrying in 5s...")
            await asyncio.sleep(5)

        def _on_task_done(task: asyncio.Task):
            """Callback để bắt exception từ các task fire-and-forget."""
            if not task.cancelled() and task.exception() is not None:
                logger.error(f"[CameraManager] Exception in processing task: {task.exception()}", exc_info=task.exception())

        try:
            while self.is_running:
                frame = await asyncio.to_thread(reader.read_frame)
                if frame is not None and (processing_task is None or processing_task.done()):
                    if processing_task is not None:
                        _on_task_done(processing_task)
                    processing_task = asyncio.create_task(self.process_callback(source, frame))
                # No sleep here — incomplete tracks must be detected every frame.
                # The background thread in StreamReader continuously reads frames
                # so _latest_frame is always fresh. Removing throttle ensures
                # detector runs on every camera frame until tracks complete.
        except asyncio.CancelledError:
            logger.info(f"Camera loop for {source} cancelled.")
        finally:
            if processing_task is not None:
                if processing_task.done():
                    _on_task_done(processing_task)
                else:
                    processing_task.cancel()
                    await asyncio.gather(processing_task, return_exceptions=True)
            reader.release()

    async def start_all(self):
        self.is_running = True
        for source in self.sources:
            task = asyncio.create_task(self._camera_loop(source))
            self.tasks.append(task)
        logger.info(f"Started {len(self.tasks)} camera workers.")

    async def stop_all(self):
        self.is_running = False
        for task in self.tasks:
            task.cancel()
        
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        self.tasks = []
        logger.info("All camera workers stopped.")
