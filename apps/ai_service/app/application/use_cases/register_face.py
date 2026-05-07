import logging
from datetime import datetime, timezone

from app.domain.entities.face import FaceInput
from app.domain.interfaces.embedder import IFaceEmbedder
from app.domain.interfaces.vector_store import IVectorStore

logger = logging.getLogger(__name__)


class RegisterFaceUseCase:
    """
    Registration use case: extract embedding from a face crop and upsert into Qdrant.

    Called when `registration.requested` event is consumed from Redis Stream.
    Publishes `registration_processing.completed` (via the event handler, not here).
    """

    def __init__(self, embedder: IFaceEmbedder, vector_store: IVectorStore) -> None:
        self._embedder = embedder
        self._vector_store = vector_store

    async def execute(
        self, face: FaceInput, person_id: str, registration_id: str
    ) -> dict:
        """
        Returns a result dict that the handler uses to build the outbound event.
        Raises on failure so the handler can publish status="failed".
        """
        logger.info(
            "Registering face person_id=%s registration_id=%s", person_id, registration_id
        )

        embedding = await self._embedder.extract(face)

        await self._vector_store.upsert(
            registration_id=registration_id,
            person_id=person_id,
            vector=embedding.vector,
        )

        indexed_at = datetime.now(timezone.utc).isoformat()
        logger.info(
            "Registration indexed person_id=%s registration_id=%s model=%s",
            person_id,
            registration_id,
            embedding.embedding_model,
        )

        return {
            "status": "indexed",
            "embedding_model": embedding.embedding_model,
            "embedding_version": embedding.embedding_version,
            "indexed_at": indexed_at,
        }
