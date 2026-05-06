from datetime import datetime, timezone
from uuid import uuid4

from app.application.use_cases.face_registrations import (
    ApplyRegistrationInputValidationUseCase,
    CompleteFaceRegistrationUseCase,
    CreateFaceRegistrationUseCase,
    CreateRegistrationCommand,
    RegistrationCompletedCommand,
    RegistrationInputValidatedCommand,
)
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.media_assets.entities import MediaAsset
from app.domain.persons.entities import Person
from app.domain.shared.enums import MediaAssetType, PersonStatus, RegistrationStatus, StorageProvider


class FakePersonRepo:
    def get_person(self, _person_id):
        return Person(
            id=uuid4(),
            employee_code="E001",
            full_name="Tester",
            department_id=None,
            title=None,
            email=None,
            phone=None,
            status=PersonStatus.ACTIVE,
            joined_at=None,
            notes=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )


class FakeMediaRepo:
    def create_media_asset(self, **kwargs):
        return MediaAsset(
            id=uuid4(),
            storage_provider=StorageProvider(kwargs["storage_provider"]),
            bucket_name=kwargs["bucket_name"],
            object_key=kwargs["object_key"],
            original_filename=kwargs["original_filename"],
            mime_type=kwargs["mime_type"],
            file_size=kwargs["file_size"],
            checksum=kwargs.get("checksum"),
            asset_type=MediaAssetType(kwargs["asset_type"]),
            uploaded_by_person_id=kwargs.get("uploaded_by_person_id"),
            created_at=datetime.now(timezone.utc),
        )


class FakeRegistrationRepo:
    def __init__(self):
        self.registration = None

    def create_registration(self, *, person_id, source_media_asset_id, validation_notes=None):
        self.registration = PersonFaceRegistration(
            id=uuid4(),
            person_id=person_id,
            source_media_asset_id=source_media_asset_id,
            face_image_media_asset_id=None,
            registration_status=RegistrationStatus.PENDING,
            validation_notes=validation_notes,
            embedding_model=None,
            embedding_version=None,
            is_active=True,
            indexed_at=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        return self.registration

    def update_registration_processing_result(self, registration_id, **kwargs):
        if self.registration is None or self.registration.id != registration_id:
            return None
        self.registration.registration_status = kwargs["status"]
        self.registration.embedding_model = kwargs.get("embedding_model")
        return self.registration

    def apply_registration_input_validation(self, registration_id, **kwargs):
        if self.registration is None or self.registration.id != registration_id:
            return None
        if kwargs.get("rejected"):
            self.registration.registration_status = RegistrationStatus.FAILED
        self.registration.validation_notes = kwargs.get("validation_notes")
        self.registration.face_image_media_asset_id = kwargs.get("face_image_media_asset_id")
        return self.registration


def test_create_face_registration_use_case_returns_registration_and_media_ref():
    person_repo = FakePersonRepo()
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    use_case = CreateFaceRegistrationUseCase(person_repo, reg_repo, media_repo)

    registration, media_ref = use_case.execute(
        CreateRegistrationCommand(
            person_id=uuid4(),
            requested_by_person_id=uuid4(),
            source_media_asset={
                "storage_provider": "minio",
                "bucket_name": "attendance",
                "object_key": "uploads/a.jpg",
                "original_filename": "a.jpg",
                "mime_type": "image/jpeg",
                "file_size": 10,
                "checksum": None,
                "asset_type": "registration_face",
            },
            notes=None,
        )
    )

    assert registration.registration_status == RegistrationStatus.PENDING
    assert media_ref["storage_provider"] == "minio"


def test_complete_face_registration_use_case_updates_status():
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    created = reg_repo.create_registration(person_id=uuid4(), source_media_asset_id=uuid4())
    use_case = CompleteFaceRegistrationUseCase(reg_repo, media_repo)

    updated = use_case.execute(
        RegistrationCompletedCommand(
            registration_id=created.id,
            status=RegistrationStatus.INDEXED,
            embedding_model="facenet",
        )
    )

    assert updated.registration_status == RegistrationStatus.INDEXED
    assert updated.embedding_model == "facenet"


def test_apply_registration_input_validation_use_case_marks_failed_when_rejected():
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    created = reg_repo.create_registration(person_id=uuid4(), source_media_asset_id=uuid4())
    use_case = ApplyRegistrationInputValidationUseCase(reg_repo, media_repo)

    updated = use_case.execute(
        RegistrationInputValidatedCommand(
            registration_id=created.id,
            status="rejected",
            validation_notes="blurred image",
        )
    )

    assert updated.registration_status == RegistrationStatus.FAILED
    assert updated.validation_notes == "blurred image"
