"""Seed demo data for frontend testing (PostgreSQL only)."""

from __future__ import annotations

import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.bootstrap.container import build_container
from app.domain.shared.enums import EventDirection, MediaAssetType, PersonStatus, RegistrationStatus, StorageProvider
from app.infrastructure.persistence.models.department_model import DepartmentModel
from app.infrastructure.persistence.models.face_registration_model import FaceRegistrationModel
from app.infrastructure.persistence.models.media_asset_model import MediaAssetModel
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel


DEPARTMENTS = [
    {
        "id": UUID("10000000-0000-0000-0000-000000000001"),
        "code": "ENG",
        "name": "Engineering",
        "parent_id": None,
        "is_active": True,
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000002"),
        "code": "QA",
        "name": "Quality Assurance",
        "parent_id": UUID("10000000-0000-0000-0000-000000000001"),
        "is_active": True,
    },
    {
        "id": UUID("10000000-0000-0000-0000-000000000003"),
        "code": "HR",
        "name": "Human Resources",
        "parent_id": None,
        "is_active": True,
    },
]

PERSONS = [
    {
        "id": UUID("20000000-0000-0000-0000-000000000001"),
        "employee_code": "EMP001",
        "full_name": "Nguyen Van A",
        "department_id": UUID("10000000-0000-0000-0000-000000000001"),
        "title": "Backend Engineer",
        "email": "a@company.local",
        "phone": "0900000001",
        "status": PersonStatus.ACTIVE,
        "joined_at": date(2025, 1, 10),
        "notes": "Core API owner",
    },
    {
        "id": UUID("20000000-0000-0000-0000-000000000002"),
        "employee_code": "EMP002",
        "full_name": "Tran Thi B",
        "department_id": UUID("10000000-0000-0000-0000-000000000002"),
        "title": "QA Engineer",
        "email": "b@company.local",
        "phone": "0900000002",
        "status": PersonStatus.ACTIVE,
        "joined_at": date(2025, 3, 1),
        "notes": "Attendance flow tester",
    },
    {
        "id": UUID("20000000-0000-0000-0000-000000000003"),
        "employee_code": "EMP003",
        "full_name": "Le Van C",
        "department_id": UUID("10000000-0000-0000-0000-000000000003"),
        "title": "HR Specialist",
        "email": "c@company.local",
        "phone": "0900000003",
        "status": PersonStatus.RESIGNED,
        "joined_at": date(2024, 11, 15),
        "notes": "Resigned sample",
    },
]


def main() -> None:
    now = datetime.now(UTC)
    container = build_container()
    with container.session_factory() as session:
        existing_persons = session.query(PersonModel).count()
        if existing_persons > 0:
            print("Skip seeding: persons table already has data.")
            return

        for dept in DEPARTMENTS:
            session.add(
                DepartmentModel(
                    id=dept["id"],
                    code=dept["code"],
                    name=dept["name"],
                    parent_id=dept["parent_id"],
                    is_active=dept["is_active"],
                    created_at=now,
                    updated_at=now,
                )
            )

        for person in PERSONS:
            session.add(
                PersonModel(
                    id=person["id"],
                    employee_code=person["employee_code"],
                    full_name=person["full_name"],
                    department_id=person["department_id"],
                    title=person["title"],
                    email=person["email"],
                    phone=person["phone"],
                    status=person["status"],
                    joined_at=person["joined_at"],
                    notes=person["notes"],
                    created_at=now,
                    updated_at=now,
                )
            )

        session.flush()

        media_asset_id = UUID("30000000-0000-0000-0000-000000000001")
        face_registration_id = UUID("40000000-0000-0000-0000-000000000001")
        recognition_event_id = UUID("50000000-0000-0000-0000-000000000001")

        session.add(
            MediaAssetModel(
                id=media_asset_id,
                storage_provider=StorageProvider.MINIO,
                bucket_name="attendance",
                object_key="registrations/raw/EMP001.jpg",
                original_filename="emp001.jpg",
                mime_type="image/jpeg",
                file_size=120_000,
                checksum=None,
                asset_type=MediaAssetType.REGISTRATION_FACE,
                uploaded_by_person_id=PERSONS[0]["id"],
                created_at=now,
            )
        )
        session.flush()

        session.add(
            FaceRegistrationModel(
                id=face_registration_id,
                person_id=PERSONS[0]["id"],
                source_media_asset_id=media_asset_id,
                face_image_media_asset_id=None,
                registration_status=RegistrationStatus.INDEXED,
                validation_notes="Seeded demo registration",
                embedding_model="arcface",
                embedding_version="v1",
                is_active=True,
                indexed_at=now - timedelta(days=1),
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
        )
        session.flush()

        session.add(
            RecognitionEventModel(
                id=recognition_event_id,
                person_id=PERSONS[0]["id"],
                face_registration_id=face_registration_id,
                snapshot_media_asset_id=None,
                recognized_at=now - timedelta(hours=2),
                event_direction=EventDirection.ENTRY,
                match_score=0.9821,
                spoof_score=0.0123,
                event_source="seed_script",
                dedupe_key="seed-recognition-emp001-entry",
                raw_payload={"source": "seed_frontend_demo_data"},
                is_valid=True,
                invalid_reason=None,
                created_at=now - timedelta(hours=2),
            )
        )

        session.commit()
        print("Seeded demo data: 3 departments, 3 persons, 1 registration, 1 attendance event.")


if __name__ == "__main__":
    main()
