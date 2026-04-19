"""Domain value objects."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID


@dataclass(slots=True, kw_only=True)
class AuditTimestamps:
    created_at: datetime
    updated_at: datetime | None = None


@dataclass(slots=True, kw_only=True)
class TimeRange:
    start_at: datetime
    end_at: datetime

    def __post_init__(self) -> None:
        if self.end_at < self.start_at:
            raise ValueError("end_at must be greater than or equal to start_at")


@dataclass(slots=True, kw_only=True)
class AttendanceWindow:
    work_date: date
    period: TimeRange


@dataclass(slots=True, kw_only=True)
class MediaPointer:
    media_asset_id: UUID
