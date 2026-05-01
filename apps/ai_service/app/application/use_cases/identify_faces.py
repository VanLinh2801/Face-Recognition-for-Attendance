import logging
from typing import Optional

from app.core.config import settings
from app.domain.entities.face import FaceInput
from app.domain.entities.recognition_result import (
    MatchDetail,
    RecognitionDecision,
    RecognitionResult,
)
from app.domain.interfaces.anti_spoofer import IAntiSpoofer
from app.domain.interfaces.embedder import IFaceEmbedder
from app.domain.interfaces.vector_store import IVectorStore

logger = logging.getLogger(__name__)


class IdentifyFacesUseCase:
    """
    Core recognition use case.

    Pipeline:
        1. Anti-spoof check   → SPOOFED if fails (no event emitted)
        2. Embedding extract  → 512-d vector
        3. Qdrant search      → top-1 cosine match
        4. Threshold decide   → KNOWN | UNKNOWN
    """

    def __init__(
        self,
        embedder: IFaceEmbedder,
        anti_spoofer: IAntiSpoofer,
        vector_store: IVectorStore,
    ) -> None:
        self._embedder = embedder
        self._anti_spoofer = anti_spoofer
        self._vector_store = vector_store

    async def execute(self, face: FaceInput) -> RecognitionResult:
        # ── Step 1: Anti-spoofing ─────────────────────────────────────────
        spoof_score = await self._anti_spoofer.predict(face)
        logger.debug(
            "Anti-spoof result track_id=%s spoof_score=%.4f threshold=%.2f",
            face.track_id,
            spoof_score,
            settings.SPOOF_THRESHOLD,
        )

        if spoof_score < settings.SPOOF_THRESHOLD:
            logger.warning(
                "Spoof detected track_id=%s spoof_score=%.4f", face.track_id, spoof_score
            )
            return RecognitionResult(
                track_id=face.track_id,
                decision=RecognitionDecision.SPOOFED,
                spoof_score=spoof_score,
            )

        # ── Step 2: Embedding extraction ──────────────────────────────────
        embedding = await self._embedder.extract(face)
        logger.debug("Embedding extracted track_id=%s model=%s", face.track_id, embedding.embedding_model)

        # ── Step 3: Vector search ─────────────────────────────────────────
        results = await self._vector_store.search(embedding.vector, top_k=1)

        best: Optional[MatchDetail] = None
        if results:
            top = results[0]
            best = MatchDetail(
                person_id=top.person_id,
                face_registration_id=top.registration_id,
                match_score=top.score,
            )

        # ── Step 4: Decision ──────────────────────────────────────────────
        if best and best.match_score >= settings.RECOGNITION_THRESHOLD:
            logger.info(
                "KNOWN track_id=%s person_id=%s score=%.4f",
                face.track_id,
                best.person_id,
                best.match_score,
            )
            return RecognitionResult(
                track_id=face.track_id,
                decision=RecognitionDecision.KNOWN,
                spoof_score=spoof_score,
                match=best,
            )

        logger.info(
            "UNKNOWN track_id=%s best_score=%s",
            face.track_id,
            f"{best.match_score:.4f}" if best else "N/A",
        )
        return RecognitionResult(
            track_id=face.track_id,
            decision=RecognitionDecision.UNKNOWN,
            spoof_score=spoof_score,
            match=best,  # nearest candidate for debugging
        )
