"""Anti-spoofing abstraction for AI service."""

from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

from ..core.schemas import BoundingBox


@dataclass(frozen=True)
class SpoofResult:
    is_live: bool
    score: float


class SpoofChecker:
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def check(self, image: Image.Image, face: BoundingBox) -> SpoofResult:
        _ = (image, face)
        return SpoofResult(is_live=True, score=1.0)
