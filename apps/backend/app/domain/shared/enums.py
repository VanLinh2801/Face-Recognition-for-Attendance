"""Domain enums shared across bounded contexts."""

from enum import StrEnum


class PersonStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    RESIGNED = "resigned"


class StorageProvider(StrEnum):
    MINIO = "minio"


class MediaAssetType(StrEnum):
    REGISTRATION_FACE = "registration_face"
    RECOGNITION_SNAPSHOT = "recognition_snapshot"
    UNKNOWN_SNAPSHOT = "unknown_snapshot"
    SPOOF_SNAPSHOT = "spoof_snapshot"
    FACE_CROP = "face_crop"


class RegistrationStatus(StrEnum):
    PENDING = "pending"
    VALIDATED = "validated"
    INDEXED = "indexed"
    FAILED = "failed"


class EventDirection(StrEnum):
    ENTRY = "entry"
    EXIT = "exit"
    UNKNOWN = "unknown"


class UnknownEventReviewStatus(StrEnum):
    NEW = "new"
    REVIEWED = "reviewed"
    IGNORED = "ignored"


class SpoofSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SpoofReviewStatus(StrEnum):
    NEW = "new"
    REVIEWED = "reviewed"
    IGNORED = "ignored"


class AttendanceExceptionType(StrEnum):
    OFFSITE_MEETING = "offsite_meeting"
    BUSINESS_TRIP = "business_trip"
    APPROVED_EARLY_LEAVE = "approved_early_leave"
    MANUAL_ADJUSTMENT = "manual_adjustment"
