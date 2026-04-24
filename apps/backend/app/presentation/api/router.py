"""Root API router."""

from fastapi import APIRouter

from app.presentation.api.v1 import router as v1_router
from app.presentation.api.v1.realtime_ws import router as realtime_ws_router

api_router = APIRouter(prefix="/api")
api_router.include_router(v1_router)
api_router.include_router(realtime_ws_router)
