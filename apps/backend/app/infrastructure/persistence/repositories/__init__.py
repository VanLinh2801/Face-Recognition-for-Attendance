"""Repository implementations package."""

from app.infrastructure.persistence.repositories.read_repositories import (
    SqlAlchemyFaceRegistrationRepository,
    SqlAlchemyMediaAssetRepository,
    SqlAlchemyPersonRepository,
    SqlAlchemyRecognitionEventRepository,
    SqlAlchemySpoofAlertEventRepository,
    SqlAlchemyUnknownEventRepository,
)

__all__ = [
    "SqlAlchemyFaceRegistrationRepository",
    "SqlAlchemyMediaAssetRepository",
    "SqlAlchemyPersonRepository",
    "SqlAlchemyRecognitionEventRepository",
    "SqlAlchemySpoofAlertEventRepository",
    "SqlAlchemyUnknownEventRepository",
]
