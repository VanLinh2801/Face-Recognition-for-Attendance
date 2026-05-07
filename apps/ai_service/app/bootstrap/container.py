"""
Dependency Injection container for AI Service.

Wires concrete infrastructure adapters to domain interfaces,
then builds use cases and event handlers.
All objects are singletons within the container instance.
"""
from app.application.use_cases.identify_faces import IdentifyFacesUseCase
from app.application.use_cases.register_face import RegisterFaceUseCase
from app.infrastructure.ai_models.insightface_embedder import InsightFaceEmbedder
from app.infrastructure.ai_models.onnx_anti_spoofer import OnnxAntiSpoofer
from app.infrastructure.integration.minio_client import MinioImageClient
from app.infrastructure.integration.redis_consumer import RedisStreamConsumer
from app.infrastructure.integration.redis_publisher import RedisStreamPublisher
from app.infrastructure.persistence.qdrant_vector_store import QdrantVectorStore
from app.presentation.event_handlers.recognition_requested_handler import (
    RecognitionRequestedHandler,
)
from app.presentation.event_handlers.registration_requested_handler import (
    RegistrationRequestedHandler,
)
from app.core.config import settings


class Container:
    """
    Composition root — instantiate once at startup in main.py.
    """

    def __init__(self) -> None:
        # ── Infrastructure adapters ────────────────────────────────────────
        self.embedder = InsightFaceEmbedder()
        self.anti_spoofer = OnnxAntiSpoofer()
        self.vector_store = QdrantVectorStore()
        self.minio_client = MinioImageClient()
        self.publisher = RedisStreamPublisher()

        # ── Use cases ─────────────────────────────────────────────────────
        self.identify_faces_use_case = IdentifyFacesUseCase(
            embedder=self.embedder,
            anti_spoofer=self.anti_spoofer,
            vector_store=self.vector_store,
        )
        self.register_face_use_case = RegisterFaceUseCase(
            embedder=self.embedder,
            vector_store=self.vector_store,
        )

        # ── Event handlers ────────────────────────────────────────────────
        self.recognition_handler = RecognitionRequestedHandler(
            use_case=self.identify_faces_use_case,
            minio_client=self.minio_client,
            publisher=self.publisher,
        )
        self.registration_handler = RegistrationRequestedHandler(
            use_case=self.register_face_use_case,
            minio_client=self.minio_client,
            publisher=self.publisher,
        )

        # ── Redis consumers ───────────────────────────────────────────────
        self.pipeline_ai_consumer = RedisStreamConsumer(
            stream_name=settings.REDIS_STREAM_PIPELINE_AI,
            group_name=settings.REDIS_CONSUMER_GROUP,
            consumer_name=settings.REDIS_CONSUMER_NAME,
        )
