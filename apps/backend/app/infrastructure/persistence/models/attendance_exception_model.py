"""Attendance exception ORM model."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.shared.enums import AttendanceExceptionType
from app.infrastructure.persistence.models.base import Base


class AttendanceExceptionModel(Base):
    __tablename__ = "attendance_exceptions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    person_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    exception_type: Mapped[AttendanceExceptionType]
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    work_date: Mapped[date] = mapped_column(Date(), nullable=False)
    reason: Mapped[str] = mapped_column(Text(), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_by_person_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("persons.id"), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_person_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("persons.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
