"""Redis event ingestion use cases with combined idempotency."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from app.application.interfaces.repositories.event_inbox_repository import EventInboxRepository
from app.application.interfaces.repositories.recognition_event_repository import RecognitionEventRepository
from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository
from app.application.interfaces.unit_of_work import UnitOfWork
from app.core.exceptions import ValidationError
from app.domain.shared.enums import EventDirection, SpoofReviewStatus, SpoofSeverity, UnknownEventReviewStatus


class IngestStatus(StrEnum):
    PROCESSED = "processed"
    DUPLICATE = "duplicate"
    IGNORED = "ignored"


@dataclass(slots=True, kw_only=True)
class IngestResult:
    status: IngestStatus
    reason: str | None = None


def _required_str(payload: dict, key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"Missing required field: {key}")
    return value


def _as_uuid(value: str, key: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise ValidationError(f"Invalid UUID field: {key}") from exc


def _as_datetime(value: str, key: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError(f"Invalid datetime field: {key}") from exc


def _extract_snapshot_media_asset_id(payload: dict) -> UUID | None:
    media_asset = payload.get("snapshot_media_asset")
    if not isinstance(media_asset, dict):
        return None
    media_asset_id = media_asset.get("media_asset_id")
    if not isinstance(media_asset_id, str) or not media_asset_id:
        return None
    try:
        return UUID(media_asset_id)
    except ValueError:
        return None


class IngestRecognitionEventUseCase:
    def __init__(
        self,
        *,
        uow: UnitOfWork,
        recognition_repository: RecognitionEventRepository,
        inbox_repository: EventInboxRepository,
        throttle_window_seconds: int = 30,
    ) -> None:
        self._uow = uow
        self._recognition_repository = recognition_repository
        self._inbox_repository = inbox_repository
        self._throttle_window_seconds = throttle_window_seconds

    def execute(self, envelope: dict) -> IngestResult:
        message_id = _as_uuid(_required_str(envelope, "message_id"), "message_id")
        payload = envelope.get("payload") or {}
        if not isinstance(payload, dict):
            raise ValidationError("Invalid payload")
        dedupe_key = _required_str(payload, "dedupe_key")
        with self._uow:
            if self._inbox_repository.exists_message_id(message_id):
                return IngestResult(status=IngestStatus.DUPLICATE, reason="message_id")
            if self._recognition_repository.get_by_dedupe_key(dedupe_key) is not None:
                self._inbox_repository.add_processed_message(
                    message_id=message_id,
                    event_name=_required_str(envelope, "event_name"),
                    producer=_required_str(envelope, "producer"),
                    occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                    status=IngestStatus.DUPLICATE.value,
                    details={"duplicate_on": "dedupe_key", "dedupe_key": dedupe_key},
                )
                self._uow.commit()
                return IngestResult(status=IngestStatus.DUPLICATE, reason="dedupe_key")

            # Throttle repeated recognition for the same person before persisting.
            person_id = _as_uuid(_required_str(payload, "person_id"), "person_id")
            recognized_at = _as_datetime(_required_str(payload, "recognized_at"), "recognized_at")
            if self._throttle_window_seconds > 0:
                latest_time = self._recognition_repository.get_latest_recognition_time(person_id=person_id)
                if latest_time is not None:
                    within_window = (
                        recognized_at >= latest_time
                        and (recognized_at - latest_time).total_seconds() <= self._throttle_window_seconds
                    )
                    if within_window:
                        self._inbox_repository.add_processed_message(
                            message_id=message_id,
                            event_name=_required_str(envelope, "event_name"),
                            producer=_required_str(envelope, "producer"),
                            occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                            status=IngestStatus.IGNORED.value,
                            details={
                                "duplicate_on": "throttle_window",
                                "person_id": str(person_id),
                                "recognized_at": recognized_at.isoformat(),
                                "latest_time": latest_time.isoformat(),
                            },
                        )
                        self._uow.commit()
                        return IngestResult(status=IngestStatus.IGNORED, reason="throttled")

            self._recognition_repository.create_recognition_event(
                person_id=person_id,
                face_registration_id=_as_uuid(_required_str(payload, "face_registration_id"), "face_registration_id"),
                snapshot_media_asset_id=_extract_snapshot_media_asset_id(payload),
                recognized_at=recognized_at,
                event_direction=EventDirection(_required_str(payload, "event_direction")),
                match_score=payload.get("match_score"),
                spoof_score=payload.get("spoof_score"),
                event_source=_required_str(payload, "event_source"),
                dedupe_key=dedupe_key,
                raw_payload=payload.get("raw_payload"),
            )
            self._inbox_repository.add_processed_message(
                message_id=message_id,
                event_name=_required_str(envelope, "event_name"),
                producer=_required_str(envelope, "producer"),
                occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                status=IngestStatus.PROCESSED.value,
                details={"dedupe_key": dedupe_key},
            )
            self._uow.commit()
            return IngestResult(status=IngestStatus.PROCESSED)


class IngestUnknownEventUseCase:
    def __init__(
        self,
        *,
        uow: UnitOfWork,
        unknown_repository: UnknownEventRepository,
        inbox_repository: EventInboxRepository,
    ) -> None:
        self._uow = uow
        self._unknown_repository = unknown_repository
        self._inbox_repository = inbox_repository

    def execute(self, envelope: dict) -> IngestResult:
        message_id = _as_uuid(_required_str(envelope, "message_id"), "message_id")
        payload = envelope.get("payload") or {}
        if not isinstance(payload, dict):
            raise ValidationError("Invalid payload")
        dedupe_key = _required_str(payload, "dedupe_key")
        with self._uow:
            if self._inbox_repository.exists_message_id(message_id):
                return IngestResult(status=IngestStatus.DUPLICATE, reason="message_id")
            if self._unknown_repository.get_by_dedupe_key(dedupe_key) is not None:
                self._inbox_repository.add_processed_message(
                    message_id=message_id,
                    event_name=_required_str(envelope, "event_name"),
                    producer=_required_str(envelope, "producer"),
                    occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                    status=IngestStatus.DUPLICATE.value,
                    details={"duplicate_on": "dedupe_key", "dedupe_key": dedupe_key},
                )
                self._uow.commit()
                return IngestResult(status=IngestStatus.DUPLICATE, reason="dedupe_key")

            self._unknown_repository.create_unknown_event(
                snapshot_media_asset_id=_extract_snapshot_media_asset_id(payload),
                detected_at=_as_datetime(_required_str(payload, "detected_at"), "detected_at"),
                event_direction=EventDirection(_required_str(payload, "event_direction")),
                match_score=payload.get("match_score"),
                spoof_score=payload.get("spoof_score"),
                event_source=_required_str(payload, "event_source"),
                dedupe_key=dedupe_key,
                review_status=UnknownEventReviewStatus(_required_str(payload, "review_status")),
                notes=payload.get("notes"),
                raw_payload=payload.get("raw_payload"),
            )
            self._inbox_repository.add_processed_message(
                message_id=message_id,
                event_name=_required_str(envelope, "event_name"),
                producer=_required_str(envelope, "producer"),
                occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                status=IngestStatus.PROCESSED.value,
                details={"dedupe_key": dedupe_key},
            )
            self._uow.commit()
            return IngestResult(status=IngestStatus.PROCESSED)


class IngestSpoofAlertEventUseCase:
    def __init__(
        self,
        *,
        uow: UnitOfWork,
        spoof_repository: SpoofAlertEventRepository,
        inbox_repository: EventInboxRepository,
        throttle_window_seconds: int = 30,
    ) -> None:
        self._uow = uow
        self._spoof_repository = spoof_repository
        self._inbox_repository = inbox_repository
        self._throttle_window_seconds = throttle_window_seconds

    def execute(self, envelope: dict) -> IngestResult:
        message_id = _as_uuid(_required_str(envelope, "message_id"), "message_id")
        payload = envelope.get("payload") or {}
        if not isinstance(payload, dict):
            raise ValidationError("Invalid payload")
        dedupe_key = _required_str(payload, "dedupe_key")
        with self._uow:
            if self._inbox_repository.exists_message_id(message_id):
                return IngestResult(status=IngestStatus.DUPLICATE, reason="message_id")
            if self._spoof_repository.get_by_dedupe_key(dedupe_key) is not None:
                self._inbox_repository.add_processed_message(
                    message_id=message_id,
                    event_name=_required_str(envelope, "event_name"),
                    producer=_required_str(envelope, "producer"),
                    occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                    status=IngestStatus.DUPLICATE.value,
                    details={"duplicate_on": "dedupe_key", "dedupe_key": dedupe_key},
                )
                self._uow.commit()
                return IngestResult(status=IngestStatus.DUPLICATE, reason="dedupe_key")

            person_id_raw = payload.get("person_id")
            person_id = _as_uuid(person_id_raw, "person_id") if isinstance(person_id_raw, str) else None
            detected_at = _as_datetime(_required_str(payload, "detected_at"), "detected_at")

            # Throttle repeated spoof alerts for the same person before persisting.
            if self._throttle_window_seconds > 0 and person_id is not None:
                latest_time = self._spoof_repository.get_latest_spoof_time(person_id=person_id)
                if latest_time is not None:
                    within_window = (
                        detected_at >= latest_time
                        and (detected_at - latest_time).total_seconds() <= self._throttle_window_seconds
                    )
                    if within_window:
                        self._inbox_repository.add_processed_message(
                            message_id=message_id,
                            event_name=_required_str(envelope, "event_name"),
                            producer=_required_str(envelope, "producer"),
                            occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                            status=IngestStatus.IGNORED.value,
                            details={
                                "duplicate_on": "throttle_window",
                                "person_id": str(person_id),
                                "detected_at": detected_at.isoformat(),
                                "latest_time": latest_time.isoformat(),
                            },
                        )
                        self._uow.commit()
                        return IngestResult(status=IngestStatus.IGNORED, reason="throttled")

            self._spoof_repository.create_spoof_alert_event(
                person_id=person_id,
                snapshot_media_asset_id=_extract_snapshot_media_asset_id(payload),
                detected_at=detected_at,
                spoof_score=float(payload["spoof_score"]),
                event_source=_required_str(payload, "event_source"),
                dedupe_key=dedupe_key,
                severity=SpoofSeverity(_required_str(payload, "severity")),
                review_status=SpoofReviewStatus(_required_str(payload, "review_status")),
                notes=payload.get("notes"),
                raw_payload=payload.get("raw_payload"),
            )
            self._inbox_repository.add_processed_message(
                message_id=message_id,
                event_name=_required_str(envelope, "event_name"),
                producer=_required_str(envelope, "producer"),
                occurred_at=_as_datetime(_required_str(envelope, "occurred_at"), "occurred_at"),
                status=IngestStatus.PROCESSED.value,
                details={"dedupe_key": dedupe_key},
            )
            self._uow.commit()
            return IngestResult(status=IngestStatus.PROCESSED)
