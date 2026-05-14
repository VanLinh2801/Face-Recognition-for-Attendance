import asyncio
import io
import logging
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import settings
from app.domain.entities.face import FaceEmbedding, FaceInput
from app.domain.interfaces.embedder import IFaceEmbedder

logger = logging.getLogger(__name__)


class InsightFaceEmbedder(IFaceEmbedder):
    """
    IFaceEmbedder backed by the InsightFace ArcFace recognition model.

    Detection and landmarking are owned by the pipeline service. This adapter
    only aligns the provided crop with pipeline landmarks and extracts a
    normalized embedding.
    """

    def __init__(self) -> None:
        self._recognition_model = None
        self._lock = asyncio.Lock()

    async def _ensure_loaded(self) -> None:
        if self._recognition_model is not None:
            return

        async with self._lock:
            if self._recognition_model is not None:
                return

            from insightface.model_zoo import get_model  # noqa: PLC0415

            model_path = self._find_recognition_model_path()
            model = get_model(str(model_path))
            model.prepare(ctx_id=settings.INSIGHTFACE_CTX_ID)
            self._recognition_model = model
            logger.info("InsightFace recognition model loaded: %s", model_path)

    @staticmethod
    def _find_recognition_model_path() -> Path:
        root = Path(settings.INSIGHTFACE_MODEL_DIR)
        model_root_candidates = [
            root / "models" / settings.INSIGHTFACE_MODEL_NAME,
            root / settings.INSIGHTFACE_MODEL_NAME,
            root,
        ]
        if settings.INSIGHTFACE_RECOGNITION_MODEL_FILE:
            candidates = [
                model_root / settings.INSIGHTFACE_RECOGNITION_MODEL_FILE
                for model_root in model_root_candidates
            ]
        else:
            recognition_files_by_pack = {
                "antelopev2": ["glintr100.onnx"],
                "buffalo_l": ["w600k_r50.onnx"],
                "buffalo_m": ["w600k_r50.onnx", "w600k_mbf.onnx"],
                "buffalo_s": ["w600k_mbf.onnx"],
            }
            filenames = recognition_files_by_pack.get(
                settings.INSIGHTFACE_MODEL_NAME,
                ["w600k_r50.onnx", "glintr100.onnx", "w600k_mbf.onnx"],
            )
            candidates = [
                model_root / filename
                for model_root in model_root_candidates
                for filename in filenames
            ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        if settings.INSIGHTFACE_AUTO_DOWNLOAD:
            logger.info(
                "InsightFace model file not found. Downloading model pack '%s' into %s",
                settings.INSIGHTFACE_MODEL_NAME,
                root,
            )
            root.mkdir(parents=True, exist_ok=True)
            try:
                from insightface.app import FaceAnalysis  # noqa: PLC0415

                app = FaceAnalysis(
                    name=settings.INSIGHTFACE_MODEL_NAME,
                    root=str(root),
                    providers=[settings.ONNX_EXECUTION_PROVIDER],
                )
                app.prepare(
                    ctx_id=settings.INSIGHTFACE_CTX_ID,
                    det_size=(settings.INSIGHTFACE_DET_SIZE, settings.INSIGHTFACE_DET_SIZE),
                )
            except Exception as exc:
                raise FileNotFoundError(
                    "InsightFace recognition model was not found and auto-download failed. "
                    "Expected one of: "
                    + ", ".join(str(path) for path in candidates)
                ) from exc

            for candidate in candidates:
                if candidate.exists():
                    return candidate

        raise FileNotFoundError(
            "InsightFace recognition model not found. Expected one of: "
            + ", ".join(str(path) for path in candidates)
        )

    async def extract(self, face: FaceInput) -> FaceEmbedding:
        await self._ensure_loaded()
        loop = asyncio.get_running_loop()

        def _infer() -> tuple[np.ndarray, float]:
            if face.kpss is None or len(face.kpss) != 5:
                raise ValueError(
                    f"Missing 5-point landmarks for track_id={face.track_id}; "
                    "AI service no longer runs FaceAnalysis detection fallback"
                )

            img = Image.open(io.BytesIO(face.image_data)).convert("RGB")
            img_array = np.array(img)[:, :, ::-1]  # RGB to BGR for InsightFace.

            from insightface.utils import face_align  # noqa: PLC0415

            kpss_np = np.array(face.kpss, dtype=np.float32)
            aligned = face_align.norm_crop(img_array, kpss_np)
            feat = self._recognition_model.get_feat(aligned)
            vector = np.array(feat, dtype=np.float32).reshape(-1)
            norm = np.linalg.norm(vector)
            if norm <= 0:
                raise ValueError(f"Empty embedding vector for track_id={face.track_id}")

            vector = vector / norm
            det_score = face.detection_confidence or 1.0
            logger.debug(
                "InsightFace embedding extracted track_id=%s det_score=%.4f",
                face.track_id,
                det_score,
            )
            return vector, det_score

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
