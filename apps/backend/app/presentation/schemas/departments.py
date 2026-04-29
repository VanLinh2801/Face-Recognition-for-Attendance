"""Department transport schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.presentation.schemas.common import PaginatedResponse


class DepartmentItemResponse(BaseModel):
    id: UUID
    code: str
    name: str
    parent_id: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentListResponse(PaginatedResponse):
    items: list[DepartmentItemResponse]


class CreateDepartmentRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    parent_id: UUID | None = None
    is_active: bool = True


class UpdateDepartmentRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: UUID | None = None
    is_active: bool | None = None

