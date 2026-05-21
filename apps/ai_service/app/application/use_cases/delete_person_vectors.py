import logging

from app.domain.interfaces.vector_store import IVectorStore

logger = logging.getLogger(__name__)


class DeletePersonVectorsUseCase:
    """Remove all indexed face vectors for one person."""

    def __init__(self, vector_store: IVectorStore) -> None:
        self._vector_store = vector_store

    async def execute(self, person_id: str) -> None:
        logger.info("Deleting face vectors person_id=%s", person_id)
        await self._vector_store.delete_by_person(person_id)
