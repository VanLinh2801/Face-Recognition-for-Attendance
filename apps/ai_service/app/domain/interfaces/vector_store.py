from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List
import numpy as np


@dataclass
class VectorSearchResult:
    """Single candidate returned by the vector store."""
    person_id: str
    registration_id: str
    score: float  # cosine similarity [0, 1] — higher = more similar


class IVectorStore(ABC):
    """
    Port for the vector database (Qdrant).
    Implementation lives in infrastructure/persistence/.

    Qdrant collection schema:
        vector  : float[512]  (ArcFace embedding)
        payload : {
            "person_id"       : UUID string,
            "registration_id" : UUID string
        }
    """

    @abstractmethod
    async def search(
        self, vector: np.ndarray, top_k: int = 1
    ) -> List[VectorSearchResult]:
        """
        Return the top-k most similar vectors in the collection.
        Returns an empty list when the collection is empty.
        """
        ...

    @abstractmethod
    async def upsert(
        self, registration_id: str, person_id: str, vector: np.ndarray
    ) -> None:
        """
        Insert or replace a vector for a given registration_id.
        Uses registration_id as the Qdrant point ID.
        """
        ...

    @abstractmethod
    async def delete(self, registration_id: str) -> None:
        """Remove a vector by registration_id."""
        ...

    @abstractmethod
    async def ensure_collection(self) -> None:
        """Create the collection if it does not yet exist."""
        ...
