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
    def __init__(self):
        self.assets_by_location = {}

    def create_media_asset(self, **kwargs):
        asset = MediaAsset(
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
        self.assets_by_location[(asset.bucket_name, asset.object_key)] = asset
        return asset

    def get_media_asset_by_location(self, *, bucket_name, object_key):
        return self.assets_by_location.get((bucket_name, object_key))


class FakeRegistrationRepo:
    def __init__(self):
        self.registration = None
        self.deactivate_calls = []

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
        face_image_media_asset_id = kwargs.get("face_image_media_asset_id")
        if face_image_media_asset_id is not None:
            self.registration.face_image_media_asset_id = face_image_media_asset_id
        return self.registration

    def apply_registration_input_validation(self, registration_id, **kwargs):
        if self.registration is None or self.registration.id != registration_id:
            return None
        if kwargs.get("rejected"):
            self.registration.registration_status = RegistrationStatus.FAILED
        else:
            self.registration.registration_status = RegistrationStatus.VALIDATED
        self.registration.validation_notes = kwargs.get("validation_notes")
        face_image_media_asset_id = kwargs.get("face_image_media_asset_id")
        if face_image_media_asset_id is not None:
            self.registration.face_image_media_asset_id = face_image_media_asset_id
        return self.registration

    def deactivate_registrations_by_person(self, person_id, *, exclude_registration_id=None):
        self.deactivate_calls.append((person_id, exclude_registration_id))
        if (
            self.registration is not None
            and self.registration.person_id == person_id
            and self.registration.id != exclude_registration_id
            and self.registration.is_active
        ):
            self.registration.is_active = False
            return 1
        return 0


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
    assert reg_repo.deactivate_calls == [(created.person_id, created.id)]


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


def test_apply_registration_input_validation_use_case_marks_validated_when_accepted():
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    created = reg_repo.create_registration(person_id=uuid4(), source_media_asset_id=uuid4())
    use_case = ApplyRegistrationInputValidationUseCase(reg_repo, media_repo)

    updated = use_case.execute(
        RegistrationInputValidatedCommand(
            registration_id=created.id,
            status="accepted",
            validation_notes=None,
            prepared_face_media_asset={
                "storage_provider": "minio",
                "bucket_name": "attendance",
                "object_key": "registration_faces/1.jpg",
                "original_filename": "1.jpg",
                "mime_type": "image/jpeg",
                "file_size": 10,
                "checksum": None,
                "asset_type": "registration_face",
            },
        )
    )

    assert updated.registration_status == RegistrationStatus.VALIDATED
    assert updated.face_image_media_asset_id is not None


def test_complete_face_registration_use_case_failed_keeps_prepared_face_asset():
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    created = reg_repo.create_registration(person_id=uuid4(), source_media_asset_id=uuid4())
    prepared_asset_id = uuid4()
    reg_repo.registration.face_image_media_asset_id = prepared_asset_id
    use_case = CompleteFaceRegistrationUseCase(reg_repo, media_repo)

    updated = use_case.execute(
        RegistrationCompletedCommand(
            registration_id=created.id,
            status=RegistrationStatus.FAILED,
            validation_notes="embedding failed",
        )
    )

    assert updated.registration_status == RegistrationStatus.FAILED
    assert updated.face_image_media_asset_id == prepared_asset_id


def test_complete_face_registration_reuses_existing_prepared_face_asset():
    reg_repo = FakeRegistrationRepo()
    media_repo = FakeMediaRepo()
    created = reg_repo.create_registration(person_id=uuid4(), source_media_asset_id=uuid4())
    media_ref = {
        "storage_provider": "minio",
        "bucket_name": "face-recognition",
        "object_key": "registration_faces/person/face.jpg",
        "original_filename": "face.jpg",
        "mime_type": "image/jpeg",
        "file_size": 10,
        "checksum": None,
        "asset_type": "registration_face",
    }
    existing_asset = media_repo.create_media_asset(**media_ref)
    reg_repo.registration.face_image_media_asset_id = existing_asset.id
    use_case = CompleteFaceRegistrationUseCase(reg_repo, media_repo)

    updated = use_case.execute(
        RegistrationCompletedCommand(
            registration_id=created.id,
            status=RegistrationStatus.INDEXED,
            embedding_model="buffalo_l",
            face_image_media_asset=media_ref,
        )
    )

    assert updated.registration_status == RegistrationStatus.INDEXED
    assert updated.face_image_media_asset_id == existing_asset.id
