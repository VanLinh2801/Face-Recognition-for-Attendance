"""Shared filter policy and validation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.core.config import Settings
from app.core.exceptions import ValidationError

EVENT_FILTER_MAX_FUTURE_HOURS = 1
ATTENDANCE_FILTER_MAX_FUTURE_DAYS = 0


@dataclass(slots=True, kw_only=True)
class FilterPolicy:
    server_now: datetime
    retention_days: int
    events_max_future_hours: int = EVENT_FILTER_MAX_FUTURE_HOURS
    attendance_max_future_days: int = ATTENDANCE_FILTER_MAX_FUTURE_DAYS


def build_filter_policy(settings: Settings, now: datetime | None = None) -> FilterPolicy:
    current_time = _to_utc(now or datetime.now(timezone.utc))
    return FilterPolicy(
        server_now=current_time,
        retention_days=max(1, settings.filter_retention_days),
    )


def validate_event_filter_range(
    *,
    from_at: datetime | None,
    to_at: datetime | None,
    settings: Settings,
    now: datetime | None = None,
) -> None:
    policy = build_filter_policy(settings, now)
    _validate_datetime_range(
        from_at=from_at,
        to_at=to_at,
        min_allowed=policy.server_now - timedelta(days=policy.retention_days),
        max_allowed=policy.server_now + timedelta(hours=policy.events_max_future_hours),
        field_prefix="events",
    )


def validate_attendance_filter_range(
    *,
    from_at: datetime | None,
    to_at: datetime | None,
    settings: Settings,
    now: datetime | None = None,
) -> None:
    policy = build_filter_policy(settings, now)
    _validate_datetime_range(
        from_at=from_at,
        to_at=to_at,
        min_allowed=policy.server_now - timedelta(days=policy.retention_days),
        max_allowed=policy.server_now + timedelta(days=policy.attendance_max_future_days),
        field_prefix="attendance",
    )


def _validate_datetime_range(
    *,
    from_at: datetime | None,
    to_at: datetime | None,
    min_allowed: datetime,
    max_allowed: datetime,
    field_prefix: str,
) -> None:
    normalized_from = _to_utc(from_at) if from_at else None
    normalized_to = _to_utc(to_at) if to_at else None

    details = {
        "min_allowed": _format_iso(min_allowed),
        "max_allowed": _format_iso(max_allowed),
    }

    if normalized_from and normalized_from < min_allowed:
        raise ValidationError(
            f"{field_prefix} from_at must be on or after {details['min_allowed']}",
            details=details,
        )
    if normalized_to and normalized_to > max_allowed:
        raise ValidationError(
            f"{field_prefix} to_at must be on or before {details['max_allowed']}",
            details=details,
        )
    if normalized_from and normalized_to and normalized_from > normalized_to:
        raise ValidationError(
            f"{field_prefix} from_at must be on or before to_at",
            details=details,
        )


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _format_iso(value: datetime) -> str:
    return _to_utc(value).isoformat().replace("+00:00", "Z")
