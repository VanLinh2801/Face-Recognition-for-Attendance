"""Common transport schemas."""

from datetime import datetime

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, str] | None = None


class PageQueryParams(BaseModel):
    page: int = 1
    page_size: int = 20


class DateRangeQueryParams(BaseModel):
    from_at: datetime | None = None
    to_at: datetime | None = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
