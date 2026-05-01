import logging
from typing import List

import numpy as np
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.domain.interfaces.vector_store import IVectorStore, VectorSearchResult

logger = logging.getLogger(__name__)


class QdrantVectorStore(IVectorStore):
    """
    IVectorStore backed by Qdrant.

    Collection schema:
        vector  : float[512], Distance.COSINE
        payload : {"person_id": str, "registration_id": str}
    """

    def __init__(self) -> None:
        self._client = AsyncQdrantClient(url=settings.QDRANT_URL)
        self._collection = settings.QDRANT_COLLECTION

    async def ensure_collection(self) -> None:
        existing = {c.name for c in (await self._client.get_collections()).collections}
        if self._collection not in existing:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=settings.QDRANT_VECTOR_SIZE,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection: %s", self._collection)
        else:
            logger.debug("Qdrant collection already exists: %s", self._collection)

    async def search(self, vector: np.ndarray, top_k: int = 1) -> List[VectorSearchResult]:
        results = await self._client.search(
            collection_name=self._collection,
            query_vector=vector.tolist(),
            limit=top_k,
            with_payload=True,
        )
        return [
            VectorSearchResult(
                person_id=r.payload["person_id"],
                registration_id=r.payload["registration_id"],
                score=r.score,
            )
            for r in results
        ]

    async def upsert(
        self, registration_id: str, person_id: str, vector: np.ndarray
    ) -> None:
        await self._client.upsert(
            collection_name=self._collection,
            points=[
                PointStruct(
                    id=registration_id,
                    vector=vector.tolist(),
                    payload={
                        "person_id": person_id,
                        "registration_id": registration_id,
                    },
                )
            ],
        )
        logger.info(
            "Upserted vector registration_id=%s person_id=%s", registration_id, person_id
        )

    async def delete(self, registration_id: str) -> None:
        from qdrant_client.models import PointIdsList  # noqa: PLC0415

        await self._client.delete(
            collection_name=self._collection,
            points_selector=PointIdsList(points=[registration_id]),
        )
        logger.info("Deleted vector registration_id=%s", registration_id)
