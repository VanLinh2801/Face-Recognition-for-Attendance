"""Compatibility module for legacy imports.

Prefer importing repositories from dedicated modules in this package.
"""

from app.infrastructure.persistence.repositories.face_registration_repository import SqlAlchemyFaceRegistrationRepository
from app.infrastructure.persistence.repositories.media_asset_repository import SqlAlchemyMediaAssetRepository
from app.infrastructure.persistence.repositories.person_repository import SqlAlchemyPersonRepository
from app.infrastructure.persistence.repositories.recognition_event_repository import SqlAlchemyRecognitionEventRepository
from app.infrastructure.persistence.repositories.spoof_alert_event_repository import SqlAlchemySpoofAlertEventRepository
from app.infrastructure.persistence.repositories.unknown_event_repository import SqlAlchemyUnknownEventRepository

__all__ = [
    "SqlAlchemyFaceRegistrationRepository",
    "SqlAlchemyMediaAssetRepository",
    "SqlAlchemyPersonRepository",
    "SqlAlchemyRecognitionEventRepository",
    "SqlAlchemySpoofAlertEventRepository",
    "SqlAlchemyUnknownEventRepository",
]
