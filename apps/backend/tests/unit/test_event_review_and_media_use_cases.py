from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.media_assets import GetMediaAssetUseCase
from app.application.use_cases.spoof_alert_events import (
    UpdateSpoofAlertEventReviewCommand,
    UpdateSpoofAlertEventReviewUseCase,
)
from app.application.use_cases.unknown_events import (
    UpdateUnknownEventReviewCommand,
    UpdateUnknownEventReviewUseCase,
)
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import (
    EventDirection,
    MediaAssetType,
    SpoofReviewStatus,
    SpoofSeverity,
    StorageProvider,
    UnknownEventReviewStatus,
)
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent


class _FakeUnknownRepository:
    def __init__(self, item: UnknownEvent | None):
        self.item = item

    def update_review(self, *_args, **_kwargs):
        return self.item


class _FakeSpoofRepository:
    def __init__(self, item: SpoofAlertEvent | None):
        self.item = item

    def update_review(self, *_args, **_kwargs):
        return self.item


class _FakeMediaRepository:
    def __init__(self, item: MediaAsset | None):
        self.item = item

    def get_media_asset(self, _asset_id):
        return self.item


def test_update_unknown_event_review_requires_at_least_one_field():
    use_case = UpdateUnknownEventReviewUseCase(_FakeUnknownRepository(None))

    with pytest.raises(ValidationError):
        use_case.execute(UpdateUnknownEventReviewCommand(event_id=uuid4()))


def test_update_unknown_event_review_raises_not_found():
    use_case = UpdateUnknownEventReviewUseCase(_FakeUnknownRepository(None))

    with pytest.raises(NotFoundError):
        use_case.execute(
            UpdateUnknownEventReviewCommand(
                event_id=uuid4(),
                review_status=UnknownEventReviewStatus.REVIEWED,
                review_status_provided=True,
            )
        )


def test_update_spoof_alert_event_review_raises_not_found():
    use_case = UpdateSpoofAlertEventReviewUseCase(_FakeSpoofRepository(None))

    with pytest.raises(NotFoundError):
        use_case.execute(
            UpdateSpoofAlertEventReviewCommand(
                event_id=uuid4(),
                review_status=SpoofReviewStatus.IGNORED,
                review_status_provided=True,
            )
        )


def test_get_media_asset_raises_not_found():
    use_case = GetMediaAssetUseCase(_FakeMediaRepository(None))

    with pytest.raises(NotFoundError):
        use_case.execute(uuid4())


def test_update_use_cases_return_updated_entities():
    now = datetime.now(timezone.utc)
    unknown = UnknownEvent(
        id=uuid4(),
        snapshot_media_asset_id=None,
        detected_at=now,
        event_direction=EventDirection.UNKNOWN,
        match_score=None,
        spoof_score=0.5,
        event_source="cam-a",
        raw_payload=None,
        review_status=UnknownEventReviewStatus.REVIEWED,
        notes="ok",
        created_at=now,
        updated_at=now,
    )
    spoof = SpoofAlertEvent(
        id=uuid4(),
        person_id=None,
        snapshot_media_asset_id=None,
        detected_at=now,
        spoof_score=0.9,
        event_source="cam-b",
        raw_payload=None,
        severity=SpoofSeverity.HIGH,
        review_status=SpoofReviewStatus.REVIEWED,
        notes=None,
        created_at=now,
        updated_at=now,
    )
    media = MediaAsset(
        id=uuid4(),
        storage_provider=StorageProvider.MINIO,
        bucket_name="attendance",
        object_key="x.jpg",
        original_filename="x.jpg",
        mime_type="image/jpeg",
        file_size=10,
        checksum=None,
        asset_type=MediaAssetType.RECOGNITION_SNAPSHOT,
        uploaded_by_person_id=None,
        created_at=now,
    )

    assert (
        UpdateUnknownEventReviewUseCase(_FakeUnknownRepository(unknown)).execute(
            UpdateUnknownEventReviewCommand(event_id=unknown.id, notes="ok", notes_provided=True)
        )
        == unknown
    )
    assert (
        UpdateSpoofAlertEventReviewUseCase(_FakeSpoofRepository(spoof)).execute(
            UpdateSpoofAlertEventReviewCommand(event_id=spoof.id, notes=None, notes_provided=True)
        )
        == spoof
    )
    assert GetMediaAssetUseCase(_FakeMediaRepository(media)).execute(media.id) == media
