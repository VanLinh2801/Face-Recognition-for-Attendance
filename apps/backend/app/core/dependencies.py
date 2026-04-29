"""Dependency wiring helpers for the API layer."""

from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, Request, WebSocket
from sqlalchemy.orm import Session

from app.application.use_cases.attendance import (
    GetAttendanceDailySummaryUseCase,
    GetAttendanceEventUseCase,
    ListAttendanceEventsUseCase,
    ListPersonAttendanceHistoryUseCase,
)
from app.application.use_cases.auth import (
    GetCurrentUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
)
from app.application.use_cases.attendance_exceptions import (
    BulkDeleteAttendanceExceptionsUseCase,
    CreateAttendanceExceptionUseCase,
    DeleteAttendanceExceptionUseCase,
    GetAttendanceExceptionUseCase,
    ListAttendanceExceptionsUseCase,
    UpdateAttendanceExceptionUseCase,
)
from app.application.use_cases.media_assets import CleanupMediaAssetsUseCase, ListMediaAssetsUseCase
from app.application.use_cases.face_registrations import (
    CompleteFaceRegistrationUseCase,
    CreateFaceRegistrationUseCase,
    DeleteFaceRegistrationUseCase,
    GetFaceRegistrationUseCase,
    ListFaceRegistrationsUseCase,
)
from app.application.use_cases.departments import (
    CreateDepartmentUseCase,
    DeleteDepartmentUseCase,
    GetDepartmentUseCase,
    ListDepartmentsUseCase,
    UpdateDepartmentUseCase,
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
from app.application.use_cases.realtime import GetRealtimeCatchupUseCase
from app.application.use_cases.spoof_alert_events import ListSpoofAlertEventsUseCase
from app.application.use_cases.unknown_events import ListUnknownEventsUseCase
from app.bootstrap.container import Container
from app.core.security import AuthenticatedPrincipal, extract_bearer_token, verify_jwt_token
from app.core.exceptions import ValidationError
from app.domain.auth.entities import User
from app.infrastructure.integrations.pipeline_client import PipelineEventPublisher
from app.infrastructure.realtime.websocket_hub import WebSocketHub
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.application.interfaces.realtime_event_bus import RealtimeEventBus


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_container_from_websocket(websocket: WebSocket) -> Container:
    return websocket.app.state.container


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


def get_list_departments_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> ListDepartmentsUseCase:
    return container.build_list_departments_use_case(session)


def get_create_department_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CreateDepartmentUseCase:
    return container.build_create_department_use_case(session)


def get_get_department_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetDepartmentUseCase:
    return container.build_get_department_use_case(session)


def get_update_department_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> UpdateDepartmentUseCase:
    return container.build_update_department_use_case(session)


def get_delete_department_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> DeleteDepartmentUseCase:
    return container.build_delete_department_use_case(session)


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


def get_cleanup_media_assets_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> CleanupMediaAssetsUseCase:
    return container.build_cleanup_media_assets_use_case(session)


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


def get_websocket_hub(container: Container = Depends(get_container)) -> WebSocketHub:
    return container.websocket_hub


def get_realtime_event_bus(container: Container = Depends(get_container)) -> RealtimeEventBus:
    return container.realtime_event_bus


def authenticate_websocket(websocket: WebSocket, container: Container) -> AuthenticatedPrincipal:
    token = extract_bearer_token(
        websocket.headers.get("authorization"),
        websocket.query_params.get("token"),
    )
    return verify_jwt_token(token, container.settings)


def get_realtime_catchup_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetRealtimeCatchupUseCase:
    return container.build_get_realtime_catchup_use_case(session)


def get_login_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> LoginUseCase:
    return container.build_login_use_case(session)


def get_refresh_access_token_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> RefreshAccessTokenUseCase:
    return container.build_refresh_access_token_use_case(session)


def get_logout_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> LogoutUseCase:
    return container.build_logout_use_case(session)


def get_current_user_use_case(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> GetCurrentUserUseCase:
    return container.build_get_current_user_use_case(session)


def get_admin_user(
    request: Request,
    use_case: GetCurrentUserUseCase = Depends(get_current_user_use_case),
    container: Container = Depends(get_container),
) -> User:
    seed_username = container.settings.auth_seed_admin_username
    if seed_username is None:
        raise ValidationError("Admin account is not configured")

    access_token = extract_bearer_token(request.headers.get("authorization"))
    user = use_case.execute(access_token)

    if user.username != seed_username:
        raise ValidationError("Admin access required", details={"username": user.username})
    return user
