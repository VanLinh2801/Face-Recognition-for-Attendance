"""Persons API endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/persons", tags=["persons"])
