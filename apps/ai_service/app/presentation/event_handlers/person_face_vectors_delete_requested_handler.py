import logging
import uuid

from app.application.use_cases.delete_person_vectors import DeletePersonVectorsUseCase

logger = logging.getLogger(__name__)


class PersonFaceVectorsDeleteRequestedHandler:
    """Handles backend cleanup requests for vectors owned by a person."""

    def __init__(self, use_case: DeletePersonVectorsUseCase) -> None:
        self._use_case = use_case

    async def handle(self, event: dict) -> None:
        payload = event.get("payload", {})
        person_id = payload.get("person_id")
        if not isinstance(person_id, str) or not person_id.strip():
            logger.error("person_face_vectors.delete_requested missing person_id")
            return

        try:
            uuid.UUID(person_id)
        except ValueError:
            logger.error("person_face_vectors.delete_requested invalid person_id=%s", person_id)
            return

        await self._use_case.execute(person_id)
        logger.info("Handled person_face_vectors.delete_requested person_id=%s", person_id)
