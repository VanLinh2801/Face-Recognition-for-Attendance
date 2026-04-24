"""Dependency wiring helpers for the API layer."""

from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.application.use_cases.attendance import (
    GetAttendanceDailySummaryUseCase,
    GetAttendanceEventUseCase,
    ListAttendanceEventsUseCase,
    ListPersonAttendanceHistoryUseCase,
)
from app.application.use_cases.attendance_exceptions import (
    BulkDeleteAttendanceExceptionsUseCase,
    CreateAttendanceExceptionUseCase,
    DeleteAttendanceExceptionUseCase,
    GetAttendanceExceptionUseCase,
    ListAttendanceExceptionsUseCase,
    UpdateAttendanceExceptionUseCase,
)
from app.application.use_cases.media_assets import ListMediaAssetsUseCase
from app.application.use_cases.face_registrations import (
    CompleteFaceRegistrationUseCase,
    CreateFaceRegistrationUseCase,
    DeleteFaceRegistrationUseCase,
    GetFaceRegistrationUseCase,
    ListFaceRegistrationsUseCase,
)
from app.application.use_cases.persons import ListPersonsUseCase
from app.application.use_cases.persons import (
    BulkDeletePersonsUseCase,
    CreatePersonUseCase,
    DeletePersonUseCase,
    GetPersonUseCase,
    UpdatePersonUseCase,
)
from app.application.use_cases.recognition_events import ListRecognitionEventsUseCase
from app.application.use_cases.spoof_alert_events import ListSpoofAlertEventsUseCase
from app.application.use_cases.unknown_events import ListUnknownEventsUseCase
from app.bootstrap.container import Container
from app.infrastructure.integrations.pipeline_client import PipelineEventPublisher
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_db_session(container: Container = Depends(get_container)) -> Generator[Session, None, None]:
    yield from container.session_provider.get_session()


def get_unit_of_work(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> SqlAlchemyUnitOfWork:
    return container.create_uow(session)


def get_list_persons_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListPersonsUseCase:
    return container.build_list_persons_use_case(session)


def get_create_person_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CreatePersonUseCase:
    return container.build_create_person_use_case(session)


def get_get_person_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetPersonUseCase:
    return container.build_get_person_use_case(session)


def get_update_person_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> UpdatePersonUseCase:
    return container.build_update_person_use_case(session)


def get_delete_person_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> DeletePersonUseCase:
    return container.build_delete_person_use_case(session)


def get_bulk_delete_persons_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> BulkDeletePersonsUseCase:
    return container.build_bulk_delete_persons_use_case(session)


def get_list_recognition_events_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListRecognitionEventsUseCase:
    return container.build_list_recognition_events_use_case(session)


def get_list_unknown_events_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListUnknownEventsUseCase:
    return container.build_list_unknown_events_use_case(session)


def get_list_spoof_alert_events_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListSpoofAlertEventsUseCase:
    return container.build_list_spoof_alert_events_use_case(session)


def get_list_media_assets_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListMediaAssetsUseCase:
    return container.build_list_media_assets_use_case(session)


def get_create_face_registration_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CreateFaceRegistrationUseCase:
    return container.build_create_face_registration_use_case(session)


def get_list_face_registrations_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListFaceRegistrationsUseCase:
    return container.build_list_face_registrations_use_case(session)


def get_get_face_registration_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetFaceRegistrationUseCase:
    return container.build_get_face_registration_use_case(session)


def get_delete_face_registration_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> DeleteFaceRegistrationUseCase:
    return container.build_delete_face_registration_use_case(session)


def get_complete_face_registration_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CompleteFaceRegistrationUseCase:
    return container.build_complete_face_registration_use_case(session)


def get_pipeline_event_publisher(
    container: Container = Depends(get_container),
) -> PipelineEventPublisher:
    return container.build_pipeline_event_publisher()


def get_list_attendance_events_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListAttendanceEventsUseCase:
    return container.build_list_attendance_events_use_case(session)


def get_get_attendance_event_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetAttendanceEventUseCase:
    return container.build_get_attendance_event_use_case(session)


def get_list_person_attendance_history_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListPersonAttendanceHistoryUseCase:
    return container.build_list_person_attendance_history_use_case(session)


def get_get_attendance_daily_summary_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetAttendanceDailySummaryUseCase:
    return container.build_get_attendance_daily_summary_use_case(session)


def get_create_attendance_exception_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CreateAttendanceExceptionUseCase:
    return container.build_create_attendance_exception_use_case(session)


def get_list_attendance_exceptions_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListAttendanceExceptionsUseCase:
    return container.build_list_attendance_exceptions_use_case(session)


def get_get_attendance_exception_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetAttendanceExceptionUseCase:
    return container.build_get_attendance_exception_use_case(session)


def get_update_attendance_exception_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> UpdateAttendanceExceptionUseCase:
    return container.build_update_attendance_exception_use_case(session)


def get_delete_attendance_exception_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> DeleteAttendanceExceptionUseCase:
    return container.build_delete_attendance_exception_use_case(session)


def get_bulk_delete_attendance_exceptions_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> BulkDeleteAttendanceExceptionsUseCase:
    return container.build_bulk_delete_attendance_exceptions_use_case(session)
