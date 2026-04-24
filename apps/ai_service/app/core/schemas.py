"""Data models for Redis stream transport."""

from __future__ import annotations

from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class FrameResolution(BaseModel):
    width: int
    height: int


class AccessTask(BaseModel):
    task_type: Literal["ACCESS"]
    camera_id: str
    image_url: str
    timestamp: str
    event_id: str = Field(default_factory=lambda: str(uuid4()))


class OnboardingTask(BaseModel):
    task_type: Literal["ONBOARDING"]
    employee_code: str
    image_url: str
    timestamp: str
    event_id: str = Field(default_factory=lambda: str(uuid4()))


class AccessResult(BaseModel):
    task_type: Literal["ACCESS_RESULT"] = "ACCESS_RESULT"
    event_id: str
    camera_id: str
    timestamp: str
    image_url: str
    status: Literal["SUCCESS", "NO_FACE", "MULTIPLE_FACES", "LOW_QUALITY", "ERROR"]
    qdrant_vector_id: Optional[str] = None
    is_new_vector: bool = False
    confidence_score: Optional[float] = None
    bounding_box: Optional[BoundingBox] = None
    frame_resolution: Optional[FrameResolution] = None
    message: str
    matched_label: Optional[Literal["EMPLOYEE_CANDIDATE", "STRANGER"]] = None


class OnboardingResult(BaseModel):
    task_type: Literal["ONBOARDING_RESULT"] = "ONBOARDING_RESULT"
    employee_code: str
    qdrant_vector_id: Optional[str] = None
    status: Literal["SUCCESS", "ERROR"]
    message: str
