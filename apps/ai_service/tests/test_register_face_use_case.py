from __future__ import annotations

import numpy as np
import pytest

from app.application.use_cases.register_face import RegisterFaceUseCase
from app.domain.entities.face import FaceEmbedding, FaceInput


class _FakeEmbedder:
    @property
    def model_name(self) -> str:
        return "antelopev2"

    @property
    def model_version(self) -> str:
        return "1.0"

    async def extract(self, face: FaceInput) -> FaceEmbedding:
        return FaceEmbedding(
            track_id=face.track_id,
            vector=np.ones(512, dtype=np.float32),
            embedding_model=self.model_name,
            embedding_version=self.model_version,
            detection_confidence=0.99,
        )


class _FakeVectorStore:
    def __init__(self) -> None:
        self.calls = []

    async def search(self, vector, top_k=1):
        return []

    async def upsert(self, registration_id: str, person_id: str, vector) -> None:
        self.calls.append(("upsert", registration_id, person_id, vector.shape[0]))

    async def delete(self, registration_id: str) -> None:
        self.calls.append(("delete", registration_id))

    async def delete_by_person(self, person_id: str, *, exclude_registration_id: str | None = None) -> None:
        self.calls.append(("delete_by_person", person_id, exclude_registration_id))

    async def ensure_collection(self) -> None:
        self.calls.append(("ensure_collection",))


@pytest.mark.asyncio
async def test_register_face_deletes_existing_person_vectors_after_upsert() -> None:
    vector_store = _FakeVectorStore()
    use_case = RegisterFaceUseCase(embedder=_FakeEmbedder(), vector_store=vector_store)

    await use_case.execute(
        FaceInput(track_id="registration-1", image_data=b"face"),
        person_id="person-1",
        registration_id="registration-1",
    )

    assert vector_store.calls[:2] == [
        ("upsert", "registration-1", "person-1", 512),
        ("delete_by_person", "person-1", "registration-1"),
    ]
