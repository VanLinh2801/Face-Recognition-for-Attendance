"""Qdrant access layer for v1 AI service."""

from __future__ import annotations

from typing import Any, Optional
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http import models


class QdrantStore:
    def __init__(
        self,
        host: str,
        port: int,
        collection_name: str,
        embedding_size: int,
        match_threshold: float,
    ) -> None:
        self._client = QdrantClient(host=host, port=port)
        self._collection_name = collection_name
        self._embedding_size = embedding_size
        self._match_threshold = match_threshold

    def ensure_collection(self) -> None:
        collections = {item.name for item in self._client.get_collections().collections}
        if self._collection_name in collections:
            return
        self._client.create_collection(
            collection_name=self._collection_name,
            vectors_config=models.VectorParams(
                size=self._embedding_size,
                distance=models.Distance.COSINE,
            ),
        )

    def search(self, vector: list[float]) -> Optional[dict[str, Any]]:
        results = self._client.search(
            collection_name=self._collection_name,
            query_vector=vector,
            limit=1,
            with_payload=True,
        )
        if not results:
            return None

        best = results[0]
        if best.score < self._match_threshold:
            return None

        return {
            "id": str(best.id),
            "score": float(best.score),
            "payload": best.payload or {},
        }

    def upsert(
        self,
        vector: list[float],
        payload: dict[str, Any],
        point_id: Optional[str] = None,
    ) -> str:
        vector_id = point_id or str(uuid4())
        self._client.upsert(
            collection_name=self._collection_name,
            points=[
                models.PointStruct(id=vector_id, vector=vector, payload=payload),
            ],
        )
        return vector_id
