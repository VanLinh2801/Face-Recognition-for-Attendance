from abc import ABC, abstractmethod
from app.domain.entities.face import FaceInput, FaceEmbedding


class IFaceEmbedder(ABC):
    """
    Port for face embedding extraction.
    Implementation lives in infrastructure/ai_models/.
    """

    @abstractmethod
    async def extract(self, face: FaceInput) -> FaceEmbedding:
        """
        Extract a 512-d embedding vector from a face crop.
        Raises ValueError if no face is found in the image.
        """
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Human-readable model name, e.g. 'buffalo_l'."""
        ...

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Version string, e.g. '1.0'."""
        ...
