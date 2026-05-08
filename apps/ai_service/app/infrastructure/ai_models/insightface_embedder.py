import asyncio
import io
import logging

import numpy as np
from PIL import Image

from app.core.config import settings
from app.domain.entities.face import FaceEmbedding, FaceInput
from app.domain.interfaces.embedder import IFaceEmbedder

logger = logging.getLogger(__name__)

class InsightFaceEmbedder(IFaceEmbedder):
    """
    IFaceEmbedder backed by InsightFace (ArcFace / buffalo_l).
    Model is lazy-loaded on first call and shared across requests.
    Inference runs in a thread-pool executor to avoid blocking the event loop.
    """

    def __init__(self) -> None:
        self._app = None
        self._lock = asyncio.Lock()

    async def _ensure_loaded(self) -> None:
        if self._app is not None:
            return
        async with self._lock:
            if self._app is not None:
                return
            # InsightFace import deferred so service starts fast without GPU init
            import insightface  # noqa: PLC0415

            app = insightface.app.FaceAnalysis(
                name=settings.INSIGHTFACE_MODEL_NAME,
                root=settings.INSIGHTFACE_MODEL_DIR,
            )
            app.prepare(
                ctx_id=settings.INSIGHTFACE_CTX_ID,
                det_size=(settings.INSIGHTFACE_DET_SIZE, settings.INSIGHTFACE_DET_SIZE),
            )
            self._app = app
            logger.info("InsightFace model loaded: %s", settings.INSIGHTFACE_MODEL_NAME)

    async def extract(self, face: FaceInput) -> FaceEmbedding:
        await self._ensure_loaded()
        loop = asyncio.get_running_loop()

        def _infer() -> np.ndarray:
            img = Image.open(io.BytesIO(face.image_data)).convert("RGB")
            img_array = np.array(img)[:, :, ::-1]  # RGB → BGR cho InsightFace
            faces = self._app.get(img_array)
            if not faces:
                raise ValueError(
                    f"InsightFace found no face in image for track_id={face.track_id}"
                )
            # Pick the face with the largest bounding box area
            best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            return best.normed_embedding  # L2-normalised 512-d vector

        vector = await loop.run_in_executor(None, _infer)
        return FaceEmbedding(
            track_id=face.track_id,
            vector=vector,
            embedding_model=settings.INSIGHTFACE_MODEL_NAME,
            embedding_version=settings.INSIGHTFACE_MODEL_VERSION,
        )

    @property
    def model_name(self) -> str:
        return settings.INSIGHTFACE_MODEL_NAME

    @property
    def model_version(self) -> str:
        return settings.INSIGHTFACE_MODEL_VERSION
