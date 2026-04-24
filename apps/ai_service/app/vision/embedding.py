"""Deterministic embedding generation for integration testing."""

from __future__ import annotations

import hashlib
from io import BytesIO

from PIL import Image

from ..core.schemas import BoundingBox


class Embedder:
    def __init__(self, embedding_size: int, model_name: str) -> None:
        self._embedding_size = embedding_size
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed(self, image: Image.Image, face: BoundingBox) -> list[float]:
        crop = image.crop((face.x, face.y, face.x + face.width, face.y + face.height))
        buffer = BytesIO()
        crop.save(buffer, format="PNG")
        digest = hashlib.sha256(buffer.getvalue()).digest()

        values: list[float] = []
        source = digest
        while len(values) < self._embedding_size:
            for byte in source:
                values.append(byte / 255.0)
                if len(values) == self._embedding_size:
                    break
            source = hashlib.sha256(source).digest()
        return values
