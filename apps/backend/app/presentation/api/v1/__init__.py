"""Version 1 API endpoints."""

from fastapi import APIRouter

from app.presentation.api.v1 import (
    attendance,
    attendance_exceptions,
    departments,
    face_registrations,
    media_assets,
    persons,
    persons_registrations,
    recognition_events,
    spoof_alert_events,
    unknown_events,
)

router = APIRouter(prefix="/v1")
router.include_router(attendance.router)
router.include_router(persons.router)
router.include_router(persons_registrations.router)
router.include_router(persons_registrations.internal_router)
router.include_router(departments.router)
router.include_router(face_registrations.router)
router.include_router(recognition_events.router)
router.include_router(unknown_events.router)
router.include_router(spoof_alert_events.router)
router.include_router(attendance_exceptions.router)
router.include_router(media_assets.router)
