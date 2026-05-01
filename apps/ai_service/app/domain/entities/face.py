from dataclasses import dataclass
from typing import Optional
import numpy as np


@dataclass(frozen=True)
class BoundingBox:
    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class FaceInput:
    """
    Represents a single face crop to be processed by AI Service.
    image_data: raw bytes of the face crop image (downloaded from MinIO).
    """
    track_id: str
    image_data: bytes
    bbox: Optional[BoundingBox] = None
    detection_confidence: Optional[float] = None
    quality_status: Optional[str] = None  # "passed" | "marginal" | "failed"


@dataclass(frozen=True)
class FaceEmbedding:
    """
    Output of the embedding extractor for a single face.
    vector: 512-d numpy array (ArcFace).
    """
    track_id: str
    vector: np.ndarray
    embedding_model: str
    embedding_version: str

    class Config:
        # allow numpy array in frozen dataclass comparison
        arbitrary_types_allowed = True
