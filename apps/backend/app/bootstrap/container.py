"""Application composition root."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

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
from app.application.use_cases.event_ingestion import (
    IngestRecognitionEventUseCase,
    IngestSpoofAlertEventUseCase,
    IngestUnknownEventUseCase,
)
from app.application.use_cases.face_registrations import (
    ApplyRegistrationInputValidationUseCase,
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
from app.core.config import Settings, get_settings
from app.core.db import create_db_engine, create_session_factory
from app.infrastructure.persistence.repositories import (
    SqlAlchemyAttendanceExceptionRepository,
    SqlAlchemyAttendanceRepository,
    SqlAlchemyEventInboxRepository,
    SqlAlchemyFaceRegistrationRepository,
    SqlAlchemyMediaAssetRepository,
    SqlAlchemyPersonRepository,
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyRecognitionEventRepository,
    SqlAlchemySpoofAlertEventRepository,
    SqlAlchemyUnknownEventRepository,
    SqlAlchemyUserRepository,
)
from app.infrastructure.integrations.pipeline_client import PipelineEventPublisher
from app.infrastructure.realtime import HubRealtimeEventBus, WebSocketHub
from app.infrastructure.persistence.session import SessionProvider
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.infrastructure.persistence.repositories.department_repository import SqlAlchemyDepartmentRepository
from app.infrastructure.storage.minio_storage_gateway import MinioStorageGateway


@dataclass(slots=True)
class Container:
    """Application dependency container."""

    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    session_provider: SessionProvider
    websocket_hub: WebSocketHub
    realtime_event_bus: HubRealtimeEventBus

    def create_uow(self, session: Session) -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(session)

    def build_list_persons_use_case(self, session: Session) -> ListPersonsUseCase:
        return ListPersonsUseCase(SqlAlchemyPersonRepository(session))

    def build_create_person_use_case(self, session: Session) -> CreatePersonUseCase:
        return CreatePersonUseCase(SqlAlchemyPersonRepository(session))

    def build_get_person_use_case(self, session: Session) -> GetPersonUseCase:
        return GetPersonUseCase(SqlAlchemyPersonRepository(session))

    def build_update_person_use_case(self, session: Session) -> UpdatePersonUseCase:
        return UpdatePersonUseCase(SqlAlchemyPersonRepository(session))

    def build_delete_person_use_case(self, session: Session) -> DeletePersonUseCase:
        return DeletePersonUseCase(SqlAlchemyPersonRepository(session))

    def build_bulk_delete_persons_use_case(self, session: Session) -> BulkDeletePersonsUseCase:
        return BulkDeletePersonsUseCase(SqlAlchemyPersonRepository(session))

    def build_list_departments_use_case(self, session: Session) -> ListDepartmentsUseCase:
        return ListDepartmentsUseCase(SqlAlchemyDepartmentRepository(session))

    def build_create_department_use_case(self, session: Session) -> CreateDepartmentUseCase:
        return CreateDepartmentUseCase(SqlAlchemyDepartmentRepository(session))

    def build_get_department_use_case(self, session: Session) -> GetDepartmentUseCase:
        return GetDepartmentUseCase(SqlAlchemyDepartmentRepository(session))

    def build_update_department_use_case(self, session: Session) -> UpdateDepartmentUseCase:
        return UpdateDepartmentUseCase(SqlAlchemyDepartmentRepository(session))

    def build_delete_department_use_case(self, session: Session) -> DeleteDepartmentUseCase:
        return DeleteDepartmentUseCase(SqlAlchemyDepartmentRepository(session))

    def build_list_recognition_events_use_case(self, session: Session) -> ListRecognitionEventsUseCase:
        return ListRecognitionEventsUseCase(SqlAlchemyRecognitionEventRepository(session))

    def build_list_unknown_events_use_case(self, session: Session) -> ListUnknownEventsUseCase:
        return ListUnknownEventsUseCase(SqlAlchemyUnknownEventRepository(session))

    def build_list_spoof_alert_events_use_case(self, session: Session) -> ListSpoofAlertEventsUseCase:
        return ListSpoofAlertEventsUseCase(SqlAlchemySpoofAlertEventRepository(session))

    def build_list_media_assets_use_case(self, session: Session) -> ListMediaAssetsUseCase:
        return ListMediaAssetsUseCase(SqlAlchemyMediaAssetRepository(session))

    def build_cleanup_media_assets_use_case(self, session: Session) -> CleanupMediaAssetsUseCase:
        return CleanupMediaAssetsUseCase(
            repository=SqlAlchemyMediaAssetRepository(session),
            storage_gateway=MinioStorageGateway(self.settings),
            settings=self.settings,
        )

    def build_list_attendance_events_use_case(self, session: Session) -> ListAttendanceEventsUseCase:
        return ListAttendanceEventsUseCase(SqlAlchemyAttendanceRepository(session))

    def build_get_attendance_event_use_case(self, session: Session) -> GetAttendanceEventUseCase:
        return GetAttendanceEventUseCase(SqlAlchemyAttendanceRepository(session))

    def build_list_person_attendance_history_use_case(self, session: Session) -> ListPersonAttendanceHistoryUseCase:
        return ListPersonAttendanceHistoryUseCase(SqlAlchemyAttendanceRepository(session))

    def build_get_attendance_daily_summary_use_case(self, session: Session) -> GetAttendanceDailySummaryUseCase:
        return GetAttendanceDailySummaryUseCase(SqlAlchemyAttendanceRepository(session))

    def build_create_attendance_exception_use_case(self, session: Session) -> CreateAttendanceExceptionUseCase:
        return CreateAttendanceExceptionUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_list_attendance_exceptions_use_case(self, session: Session) -> ListAttendanceExceptionsUseCase:
        return ListAttendanceExceptionsUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_get_attendance_exception_use_case(self, session: Session) -> GetAttendanceExceptionUseCase:
        return GetAttendanceExceptionUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_update_attendance_exception_use_case(self, session: Session) -> UpdateAttendanceExceptionUseCase:
        return UpdateAttendanceExceptionUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_delete_attendance_exception_use_case(self, session: Session) -> DeleteAttendanceExceptionUseCase:
        return DeleteAttendanceExceptionUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_bulk_delete_attendance_exceptions_use_case(
        self,
        session: Session,
    ) -> BulkDeleteAttendanceExceptionsUseCase:
        return BulkDeleteAttendanceExceptionsUseCase(SqlAlchemyAttendanceExceptionRepository(session))

    def build_create_face_registration_use_case(self, session: Session) -> CreateFaceRegistrationUseCase:
        return CreateFaceRegistrationUseCase(
            SqlAlchemyPersonRepository(session),
            SqlAlchemyFaceRegistrationRepository(session),
            SqlAlchemyMediaAssetRepository(session),
        )

    def build_list_face_registrations_use_case(self, session: Session) -> ListFaceRegistrationsUseCase:
        return ListFaceRegistrationsUseCase(SqlAlchemyFaceRegistrationRepository(session))

    def build_get_face_registration_use_case(self, session: Session) -> GetFaceRegistrationUseCase:
        return GetFaceRegistrationUseCase(SqlAlchemyFaceRegistrationRepository(session))

    def build_delete_face_registration_use_case(self, session: Session) -> DeleteFaceRegistrationUseCase:
        return DeleteFaceRegistrationUseCase(SqlAlchemyFaceRegistrationRepository(session))

    def build_complete_face_registration_use_case(self, session: Session) -> CompleteFaceRegistrationUseCase:
        return CompleteFaceRegistrationUseCase(
            SqlAlchemyFaceRegistrationRepository(session),
            SqlAlchemyMediaAssetRepository(session),
        )

    def build_apply_registration_input_validation_use_case(
        self,
        session: Session,
    ) -> ApplyRegistrationInputValidationUseCase:
        return ApplyRegistrationInputValidationUseCase(
            SqlAlchemyFaceRegistrationRepository(session),
            SqlAlchemyMediaAssetRepository(session),
        )

    def build_pipeline_event_publisher(self) -> PipelineEventPublisher:
        return PipelineEventPublisher(self.settings)

    def build_ingest_recognition_event_use_case(
        self,
        session: Session,
        uow: SqlAlchemyUnitOfWork,
    ) -> IngestRecognitionEventUseCase:
        return IngestRecognitionEventUseCase(
            uow=uow,
            recognition_repository=SqlAlchemyRecognitionEventRepository(session),
            inbox_repository=SqlAlchemyEventInboxRepository(session),
            throttle_window_seconds=self.settings.throttle_business_seconds,
        )

    def build_ingest_unknown_event_use_case(
        self,
        session: Session,
        uow: SqlAlchemyUnitOfWork,
    ) -> IngestUnknownEventUseCase:
        return IngestUnknownEventUseCase(
            uow=uow,
            unknown_repository=SqlAlchemyUnknownEventRepository(session),
            inbox_repository=SqlAlchemyEventInboxRepository(session),
        )

    def build_ingest_spoof_alert_event_use_case(
        self,
        session: Session,
        uow: SqlAlchemyUnitOfWork,
    ) -> IngestSpoofAlertEventUseCase:
        return IngestSpoofAlertEventUseCase(
            uow=uow,
            spoof_repository=SqlAlchemySpoofAlertEventRepository(session),
            inbox_repository=SqlAlchemyEventInboxRepository(session),
            throttle_window_seconds=self.settings.throttle_business_seconds,
        )

    def build_get_realtime_catchup_use_case(self, session: Session) -> GetRealtimeCatchupUseCase:
        return GetRealtimeCatchupUseCase(
            recognition_repository=SqlAlchemyRecognitionEventRepository(session),
            unknown_repository=SqlAlchemyUnknownEventRepository(session),
            spoof_repository=SqlAlchemySpoofAlertEventRepository(session),
            face_registration_repository=SqlAlchemyFaceRegistrationRepository(session),
        )

    def build_login_use_case(self, session: Session) -> LoginUseCase:
        return LoginUseCase(
            user_repository=SqlAlchemyUserRepository(session),
            refresh_token_repository=SqlAlchemyRefreshTokenRepository(session),
            settings=self.settings,
        )

    def build_refresh_access_token_use_case(self, session: Session) -> RefreshAccessTokenUseCase:
        return RefreshAccessTokenUseCase(
            user_repository=SqlAlchemyUserRepository(session),
            refresh_token_repository=SqlAlchemyRefreshTokenRepository(session),
            settings=self.settings,
        )

    def build_logout_use_case(self, session: Session) -> LogoutUseCase:
        return LogoutUseCase(SqlAlchemyRefreshTokenRepository(session))

    def build_get_current_user_use_case(self, session: Session) -> GetCurrentUserUseCase:
        return GetCurrentUserUseCase(SqlAlchemyUserRepository(session), self.settings)


def build_container(settings: Settings | None = None) -> Container:
    """Build runtime container with configured infrastructure dependencies."""
    runtime_settings = settings or get_settings()
    engine = create_db_engine(runtime_settings)
    session_factory = create_session_factory(engine)
    session_provider = SessionProvider(session_factory)
    websocket_hub = WebSocketHub(runtime_settings)
    realtime_event_bus = HubRealtimeEventBus(websocket_hub)
    return Container(
        settings=runtime_settings,
        engine=engine,
        session_factory=session_factory,
        session_provider=session_provider,
        websocket_hub=websocket_hub,
        realtime_event_bus=realtime_event_bus,
    )
