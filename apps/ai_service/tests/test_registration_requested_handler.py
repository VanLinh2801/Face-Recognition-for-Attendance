from __future__ import annotations

import sys
import types

import pytest


minio_mod = types.ModuleType("minio")


class _FakeMinioClass:
    def __init__(self, *args, **kwargs) -> None:
        pass


minio_mod.Minio = _FakeMinioClass
sys.modules.setdefault("minio", minio_mod)

from app.presentation.event_handlers.registration_requested_handler import (  # noqa: E402
    RegistrationRequestedHandler,
)


class _FakeUseCase:
    def __init__(self, result: dict | None = None) -> None:
        self.result = result or {
            "embedding_model": "buffalo_l",
            "embedding_version": "1.0",
            "indexed_at": "2026-05-07T00:00:00+00:00",
        }
        self.calls = []

    async def execute(self, face_input, person_id, registration_id):
        self.calls.append((face_input, person_id, registration_id))
        return self.result


class _FakeMinio:
    def __init__(self, image_bytes: bytes = b"image") -> None:
        self.image_bytes = image_bytes
        self.calls = []

    async def download(self, *, bucket_name: str, object_key: str) -> bytes:
        self.calls.append((bucket_name, object_key))
        return self.image_bytes


class _FailingMinio:
    async def download(self, *, bucket_name: str, object_key: str) -> bytes:
        raise RuntimeError("download failed")


class _FakePublisher:
    def __init__(self) -> None:
        self.published = []

    def build_envelope(self, event_name, correlation_id, payload):
        return {
            "event_name": event_name,
            "correlation_id": correlation_id,
            "payload": payload,
        }

    async def publish(self, stream_name, envelope):
        self.published.append((stream_name, envelope))
        return "1-0"


@pytest.mark.asyncio
async def test_registration_handler_indexes_face_media_asset() -> None:
    use_case = _FakeUseCase()
    minio = _FakeMinio(b"face-crop")
    publisher = _FakePublisher()
    handler = RegistrationRequestedHandler(use_case, minio, publisher)
    face_media_asset = {
        "storage_provider": "minio",
        "bucket_name": "attendance",
        "object_key": "registration_faces/1.jpg",
        "original_filename": "1.jpg",
        "mime_type": "image/jpeg",
        "file_size": 10,
        "checksum": None,
        "asset_type": "registration_face",
    }

    await handler.handle(
        {
            "correlation_id": "corr-1",
            "payload": {
                "person_id": "person-1",
                "registration_id": "registration-1",
                "face_media_asset": face_media_asset,
                "source_media_asset_id": "source-1",
                "quality_status": "passed",
                "kpss": [[30, 40], [70, 40], [50, 60], [35, 80], [65, 80]],
            },
        }
    )

    assert minio.calls == [("attendance", "registration_faces/1.jpg")]
    assert use_case.calls[0][0].image_data == b"face-crop"
    assert use_case.calls[0][0].kpss == [[30, 40], [70, 40], [50, 60], [35, 80], [65, 80]]
    payload = publisher.published[0][1]["payload"]
    assert payload["status"] == "indexed"
    assert payload["face_image_media_asset"] == face_media_asset
    assert payload["source_media_asset_id"] == "source-1"


@pytest.mark.asyncio
async def test_registration_handler_publishes_failed_for_missing_face_media_asset() -> None:
    publisher = _FakePublisher()
    handler = RegistrationRequestedHandler(_FakeUseCase(), _FakeMinio(), publisher)

    await handler.handle(
        {
            "correlation_id": "corr-2",
            "payload": {
                "person_id": "person-1",
                "registration_id": "registration-1",
            },
        }
    )

    payload = publisher.published[0][1]["payload"]
    assert payload["status"] == "failed"
    assert payload["failure_code"] == "MISSING_FACE_MEDIA_ASSET"
    assert payload["face_image_media_asset"] is None


@pytest.mark.asyncio
async def test_registration_handler_publishes_failed_for_download_error() -> None:
    publisher = _FakePublisher()
    handler = RegistrationRequestedHandler(_FakeUseCase(), _FailingMinio(), publisher)

    await handler.handle(
        {
            "correlation_id": "corr-3",
            "payload": {
                "person_id": "person-1",
                "registration_id": "registration-1",
                "face_media_asset": {
                    "bucket_name": "attendance",
                    "object_key": "registration_faces/missing.jpg",
                },
            },
        }
    )

    payload = publisher.published[0][1]["payload"]
    assert payload["status"] == "failed"
    assert payload["failure_code"] == "FACE_IMAGE_DOWNLOAD_FAILED"
