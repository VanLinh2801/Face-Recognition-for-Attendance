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
            
            # Sử dụng kpss từ pipeline nếu có để bỏ qua bước nhận diện lần 2
            if face.kpss is not None and len(face.kpss) == 5:
                from insightface.utils import face_align
                kpss_np = np.array(face.kpss, dtype=np.float32)
                # Tự crop thẳng mặt ra 112x112 cho ArcFace
                aimg = face_align.norm_crop(img_array, kpss_np)
                
                # Trích xuất vector đặc trưng luôn
                feat = self._app.models['recognition'].get_feat(aimg)
                # feat có thể là danh sách nếu đưa vào list ảnh, nhưng ở đây đưa 1 ảnh
                vector = feat[0] if isinstance(feat, list) else feat
                vector = np.array(vector).flatten()
                
                det_score = face.detection_confidence or 1.0
                logger.debug(
                    "InsightFace fast alignment track_id=%s det_score=%.4f",
                    face.track_id,
                    det_score
                )
                return vector, det_score

            # Chạy Fallback (Nếu kpss không có hoặc bị thiếu)
            faces = self._app.get(img_array)
            if not faces:
                raise ValueError(
                    f"InsightFace found no face in image for track_id={face.track_id}"
                )
            # Pick the face with the largest bounding box area
            best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            logger.debug(
                "InsightFace detection track_id=%s det_score=%.4f bbox=%s",
                face.track_id,
                best.det_score,
                best.bbox,
            )
            return best.normed_embedding, best.det_score

        vector, det_score = await loop.run_in_executor(None, _infer)
        return FaceEmbedding(
            track_id=face.track_id,
            vector=vector,
            embedding_model=settings.INSIGHTFACE_MODEL_NAME,
            embedding_version=settings.INSIGHTFACE_MODEL_VERSION,
            detection_confidence=float(det_score),
        )

    @property
    def model_name(self) -> str:
        return settings.INSIGHTFACE_MODEL_NAME

    @property
    def model_version(self) -> str:
        return settings.INSIGHTFACE_MODEL_VERSION
