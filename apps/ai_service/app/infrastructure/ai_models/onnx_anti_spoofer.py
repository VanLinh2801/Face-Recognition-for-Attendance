import asyncio
import io
import logging

import numpy as np
import onnxruntime as ort
from PIL import Image

from app.core.config import settings
from app.domain.entities.face import FaceInput
from app.domain.interfaces.anti_spoofer import IAntiSpoofer

logger = logging.getLogger(__name__)

# MiniFASNet input spec: RGB (80, 80), normalised to [-1, 1]
_INPUT_SIZE = (80, 80)
_MEAN = [0.5, 0.5, 0.5]
_STD = [0.5, 0.5, 0.5]


class OnnxAntiSpoofer(IAntiSpoofer):
    """
    IAntiSpoofer backed by MiniFASNet exported to ONNX.

    Output interpretation:
        model output → softmax [spoof_prob, real_prob]
        spoof_score  = real_prob   (higher = more likely real)
    """

    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._lock = asyncio.Lock()

    async def _ensure_loaded(self) -> None:
        if self._session is not None:
            return
        async with self._lock:
            if self._session is not None:
                return
            self._session = ort.InferenceSession(
                settings.ANTI_SPOOF_MODEL_PATH,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self._session.get_inputs()[0].name
            logger.info("Anti-spoof model loaded: %s", settings.ANTI_SPOOF_MODEL_PATH)

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize(_INPUT_SIZE)
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = (arr - _MEAN) / _STD
        arr = np.transpose(arr, (2, 0, 1))  # HWC → CHW
        return arr[np.newaxis, :].astype(np.float32)  # add batch dim

    async def predict(self, face: FaceInput) -> float:
        await self._ensure_loaded()
        loop = asyncio.get_running_loop()

        def _infer() -> float:
            inp = self._preprocess(face.image_data)
            output = self._session.run(None, {self._input_name: inp})[0]
            # output shape: (1, 2) — [spoof_prob, real_prob]
            real_prob = float(output[0][1])
            return real_prob

        return await loop.run_in_executor(None, _infer)
