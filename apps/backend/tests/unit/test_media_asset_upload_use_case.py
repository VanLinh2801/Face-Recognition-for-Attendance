from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.use_cases.media_assets import UploadMediaAssetCommand, UploadMediaAssetUseCase
from app.core.exceptions import ValidationError
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType, StorageProvider


class FakeMediaAssetRepository:
    def __init__(self, *, fail_create: bool = False) -> None:
        self.created_kwargs: dict | None = None
        self.fail_create = fail_create

    def create_media_asset(self, **kwargs):
        if self.fail_create:
            raise RuntimeError("db failed")
        self.created_kwargs = kwargs
        return MediaAsset(
            id=uuid4(),
            storage_provider=StorageProvider(kwargs["storage_provider"]),
            bucket_name=kwargs["bucket_name"],
            object_key=kwargs["object_key"],
            original_filename=kwargs["original_filename"],
            mime_type=kwargs["mime_type"],
            file_size=kwargs["file_size"],
            checksum=kwargs["checksum"],
            asset_type=MediaAssetType(kwargs["asset_type"]),
            uploaded_by_person_id=kwargs["uploaded_by_person_id"],
            created_at=datetime.now(timezone.utc),
        )


class FakeStorageGateway:
    def __init__(self, *, fail_put: bool = False) -> None:
        self.put_request: dict | None = None
        self.deleted: list[tuple[str, str]] = []
        self.fail_put = fail_put

    def put_object(self, **kwargs) -> None:
        if self.fail_put:
            raise RuntimeError("minio failed")
        self.put_request = kwargs

    def delete_object(self, *, bucket_name: str, object_key: str) -> None:
        self.deleted.append((bucket_name, object_key))


def test_upload_media_asset_stores_object_and_creates_asset() -> None:
    repository = FakeMediaAssetRepository()
    storage = FakeStorageGateway()
    use_case = UploadMediaAssetUseCase(repository, storage, _settings())

    result = use_case.execute(
        UploadMediaAssetCommand(
            file_data=BytesIO(b"image"),
            filename="Nguyen Van A.jpg",
            mime_type="image/jpeg",
            file_size=5,
        )
    )

    assert result.bucket_name == "attendance"
    assert result.asset_type == MediaAssetType.REGISTRATION_FACE
    assert result.object_key.startswith("registrations/raw/")
    assert result.object_key.endswith("-Nguyen-Van-A.jpg")
    assert storage.put_request is not None
    assert repository.created_kwargs is not None


def test_upload_media_asset_rejects_invalid_mime_and_size() -> None:
    use_case = UploadMediaAssetUseCase(FakeMediaAssetRepository(), FakeStorageGateway(), _settings(max_bytes=4))

    with pytest.raises(ValidationError):
        use_case.execute(
            UploadMediaAssetCommand(
                file_data=BytesIO(b"image"),
                filename="a.gif",
                mime_type="image/gif",
                file_size=5,
            )
        )
    with pytest.raises(ValidationError):
        use_case.execute(
            UploadMediaAssetCommand(
                file_data=BytesIO(b"image"),
                filename="a.jpg",
                mime_type="image/jpeg",
                file_size=5,
            )
        )


def test_upload_media_asset_does_not_create_asset_when_storage_fails() -> None:
    repository = FakeMediaAssetRepository()
    storage = FakeStorageGateway(fail_put=True)
    use_case = UploadMediaAssetUseCase(repository, storage, _settings())

    with pytest.raises(RuntimeError):
        use_case.execute(
            UploadMediaAssetCommand(
                file_data=BytesIO(b"image"),
                filename="a.jpg",
                mime_type="image/jpeg",
                file_size=5,
            )
        )

    assert repository.created_kwargs is None


def test_upload_media_asset_cleans_up_object_when_asset_create_fails() -> None:
    repository = FakeMediaAssetRepository(fail_create=True)
    storage = FakeStorageGateway()
    use_case = UploadMediaAssetUseCase(repository, storage, _settings())

    with pytest.raises(RuntimeError):
        use_case.execute(
            UploadMediaAssetCommand(
                file_data=BytesIO(b"image"),
                filename="a.jpg",
                mime_type="image/jpeg",
                file_size=5,
            )
        )

    assert storage.deleted


def _settings(max_bytes: int = 1024) -> SimpleNamespace:
    return SimpleNamespace(minio_bucket="attendance", media_upload_max_bytes=max_bytes)
