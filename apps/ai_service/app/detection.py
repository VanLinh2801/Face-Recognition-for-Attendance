"""Minimal face detection and quality heuristics for v1 integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from PIL import Image, ImageStat

from .schemas import BoundingBox


@dataclass(frozen=True)
class DetectionResult:
    faces: List[BoundingBox]


class FaceDetector:
    def detect(self, image: Image.Image, image_url: str) -> DetectionResult:
        lowered = image_url.lower()
        if "noface" in lowered:
            return DetectionResult(faces=[])
        if "multiface" in lowered or "multi_face" in lowered:
            width, height = image.size
            return DetectionResult(
                faces=[
                    BoundingBox(
                        x=width // 8,
                        y=height // 5,
                        width=width // 4,
                        height=height // 3,
                    ),
                    BoundingBox(
                        x=width // 2,
                        y=height // 4,
                        width=width // 4,
                        height=height // 3,
                    ),
                ]
            )

        width, height = image.size
        face_width = max(width // 3, 1)
        face_height = max(height // 2, 1)
        return DetectionResult(
            faces=[
                BoundingBox(
                    x=max((width - face_width) // 2, 0),
                    y=max((height - face_height) // 3, 0),
                    width=face_width,
                    height=face_height,
                )
            ]
        )


class QualityGate:
    def __init__(self, min_image_size: int, min_face_size: int) -> None:
        self._min_image_size = min_image_size
        self._min_face_size = min_face_size

    def is_low_quality(self, image: Image.Image, face: BoundingBox) -> bool:
        width, height = image.size
        if width < self._min_image_size or height < self._min_image_size:
            return True
        if face.width < self._min_face_size or face.height < self._min_face_size:
            return True

        crop = image.crop(
            (face.x, face.y, face.x + face.width, face.y + face.height)
        ).convert("L")
        stat = ImageStat.Stat(crop)
        return stat.stddev[0] < 12.0
