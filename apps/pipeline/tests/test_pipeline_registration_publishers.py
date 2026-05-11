from __future__ import annotations

import importlib
import sys
import types

import pytest


minio_mod = types.ModuleType("minio")


class _FakeMinioClass:
    def __init__(self, *args, **kwargs) -> None:
        pass

    def bucket_exists(self, _bucket_name: str) -> bool:
        return True


minio_mod.Minio = _FakeMinioClass
sys.modules.setdefault("minio", minio_mod)

onnx_mod = types.ModuleType("onnxruntime")
onnx_mod.InferenceSession = object
sys.modules.setdefault("onnxruntime", onnx_mod)

cv2_mod = types.ModuleType("cv2")
cv2_mod.IMREAD_COLOR = 1
sys.modules.setdefault("cv2", cv2_mod)

pipeline_module = importlib.import_module("app.services.pipeline_service")


class _FakeRedisStreamClient:
    def __init__(self) -> None:
        self.sent = []

    async def send_event(self, stream_key: str, payload: dict):
        self.sent.append((stream_key, payload))


@pytest.mark.asyncio
async def test_publish_registration_input_validated_uses_pipeline_backend_stream(monkeypatch) -> None:
    fake_client = _FakeRedisStreamClient()
    monkeypatch.setattr(pipeline_module, "redis_stream_client", fake_client)
    service = pipeline_module.PipelineService.__new__(pipeline_module.PipelineService)

    await service._publish_registration_input_validated(
        person_id="person-1",
        registration_id="registration-1",
        correlation_id="corr-1",
        status="accepted",
        source_media_asset_id="source-1",
        prepared_face_media_asset={"bucket_name": "attendance", "object_key": "face.jpg"},
        quality_status="passed",
        pipeline_metadata={"bbox": [1.0, 2.0, 3.0, 4.0]},
    )

    assert fake_client.sent[0][0] == pipeline_module.settings.STREAM_PIPELINE_EVENTS
    envelope = fake_client.sent[0][1]
    assert envelope["event_name"] == "registration_input.validated"
    assert envelope["producer"] == "pipeline"
    assert envelope["correlation_id"] == "corr-1"
    assert envelope["payload"]["status"] == "accepted"
    assert envelope["payload"]["prepared_face_media_asset"]["object_key"] == "face.jpg"


@pytest.mark.asyncio
async def test_publish_registration_to_ai_service_uses_face_media_asset(monkeypatch) -> None:
    fake_client = _FakeRedisStreamClient()
    monkeypatch.setattr(pipeline_module, "redis_stream_client", fake_client)
    service = pipeline_module.PipelineService.__new__(pipeline_module.PipelineService)

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
    await service._publish_registration_to_ai_service(
        person_id="person-1",
        registration_id="registration-1",
        correlation_id="corr-2",
        face_media_asset=face_media_asset,
        source_media_asset_id="source-1",
        quality_status="passed",
        pipeline_metadata={"bbox": [1.0, 2.0, 3.0, 4.0]},
    )

    assert fake_client.sent[0][0] == pipeline_module.settings.STREAM_VISION_PROCESS
    envelope = fake_client.sent[0][1]
    assert envelope["event_name"] == "registration.requested"
    assert envelope["producer"] == "pipeline"
    assert envelope["payload"]["face_media_asset"] == face_media_asset
    assert "source_media_asset" not in envelope["payload"]
