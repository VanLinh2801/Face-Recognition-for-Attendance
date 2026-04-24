"""Spoof alert API endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/spoof-alert-events", tags=["spoof-alert-events"])
