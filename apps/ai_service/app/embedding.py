"""Deterministic embedding generation for integration testing."""

from __future__ import annotations

import hashlib
from io import BytesIO

from PIL import Image

from .schemas import BoundingBox


class Embedder:
    def __init__(self, embedding_size: int) -> None:
        self._embedding_size = embedding_size

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
