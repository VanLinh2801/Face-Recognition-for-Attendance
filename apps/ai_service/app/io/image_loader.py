"""Image download helpers."""

from __future__ import annotations

from io import BytesIO

import requests
from PIL import Image


class ImageLoader:
    def __init__(self, timeout_seconds: int) -> None:
        self._timeout_seconds = timeout_seconds

    def load(self, image_url: str) -> Image.Image:
        response = requests.get(image_url, timeout=self._timeout_seconds)
        response.raise_for_status()
        return Image.open(BytesIO(response.content)).convert("RGB")
