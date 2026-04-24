"""Phase 1 initial schema.

Revision ID: 20260419_0001
Revises:
Create Date: 2026-04-19 15:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260419_0001"
down_revision = None
branch_labels = None
depends_on = None


person_status_enum = postgresql.ENUM(
    "active",
    "inactive",
    "resigned",
    name="person_status",
)
storage_provider_enum = postgresql.ENUM(
    "minio",
    name="storage_provider",
)
media_asset_type_enum = postgresql.ENUM(
    "registration_face",
    "recognition_snapshot",
    "unknown_snapshot",
    "spoof_snapshot",
    "face_crop",
    name="media_asset_type",
)
registration_status_enum = postgresql.ENUM(
    "pending",
    "validated",
    "indexed",
    "failed",
    name="registration_status",
)
event_direction_enum = postgresql.ENUM(
    "entry",
    "exit",
    "unknown",
    name="event_direction",
)
unknown_event_review_status_enum = postgresql.ENUM(
    "new",
    "reviewed",
    "ignored",
    name="unknown_event_review_status",
)
spoof_severity_enum = postgresql.ENUM(
    "low",
    "medium",
    "high",
    name="spoof_severity",
)
spoof_review_status_enum = postgresql.ENUM(
    "new",
    "reviewed",
    "ignored",
    name="spoof_review_status",
)
attendance_exception_type_enum = postgresql.ENUM(
    "offsite_meeting",
    "business_trip",
    "approved_early_leave",
    "manual_adjustment",
    name="attendance_exception_type",
)


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    bind = op.get_bind()
    person_status_enum.create(bind, checkfirst=True)
    storage_provider_enum.create(bind, checkfirst=True)
    media_asset_type_enum.create(bind, checkfirst=True)
    registration_status_enum.create(bind, checkfirst=True)
    event_direction_enum.create(bind, checkfirst=True)
    unknown_event_review_status_enum.create(bind, checkfirst=True)
    spoof_severity_enum.create(bind, checkfirst=True)
    spoof_review_status_enum.create(bind, checkfirst=True)
    attendance_exception_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "departments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["departments.id"],
            name="fk_departments_parent_id_departments",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("code", name="uq_departments_code"),
    )

    op.create_table(
        "persons",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("employee_code", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            person_status_enum,
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("joined_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.id"],
            name="fk_persons_department_id_departments",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("employee_code", name="uq_persons_employee_code"),
    )

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )

    op.create_table(
        "media_assets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "storage_provider",
            storage_provider_enum,
            nullable=False,
            server_default=sa.text("'minio'"),
        ),
        sa.Column("bucket_name", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("asset_type", media_asset_type_enum, nullable=False),
        sa.Column("uploaded_by_person_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_person_id"],
            ["persons.id"],
            name="fk_media_assets_uploaded_by_person_id_persons",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("bucket_name", "object_key", name="uq_media_assets_bucket_object"),
    )

    op.create_table(
        "person_face_registrations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_media_asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("face_image_media_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "registration_status",
            registration_status_enum,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("validation_notes", sa.Text(), nullable=True),
        sa.Column("embedding_model", sa.String(length=255), nullable=True),
        sa.Column("embedding_version", sa.String(length=100), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["face_image_media_asset_id"],
            ["media_assets.id"],
            name="fk_face_registrations_face_image_media_asset_id_media_assets",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            name="fk_face_registrations_person_id_persons",
        ),
        sa.ForeignKeyConstraint(
            ["source_media_asset_id"],
            ["media_assets.id"],
            name="fk_face_registrations_source_media_asset_id_media_assets",
        ),
    )

    op.create_table(
        "recognition_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("face_registration_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_media_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recognized_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "event_direction",
            event_direction_enum,
            nullable=False,
            server_default=sa.text("'unknown'"),
        ),
        sa.Column("match_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("spoof_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("event_source", sa.String(length=100), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "is_valid",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("invalid_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["face_registration_id"],
            ["person_face_registrations.id"],
            name="fk_recognition_events_face_registration_id_registrations",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            name="fk_recognition_events_person_id_persons",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_media_asset_id"],
            ["media_assets.id"],
            name="fk_recognition_events_snapshot_media_asset_id_media_assets",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("dedupe_key", name="uq_recognition_events_dedupe_key"),
    )

    op.create_table(
        "unknown_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("snapshot_media_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "event_direction",
            event_direction_enum,
            nullable=False,
            server_default=sa.text("'unknown'"),
        ),
        sa.Column("match_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("spoof_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("event_source", sa.String(length=100), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "review_status",
            unknown_event_review_status_enum,
            nullable=False,
            server_default=sa.text("'new'"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_media_asset_id"],
            ["media_assets.id"],
            name="fk_unknown_events_snapshot_media_asset_id_media_assets",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("dedupe_key", name="uq_unknown_events_dedupe_key"),
    )

    op.create_table(
        "spoof_alert_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("snapshot_media_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("spoof_score", sa.Numeric(5, 4), nullable=False),
        sa.Column("event_source", sa.String(length=100), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "severity",
            spoof_severity_enum,
            nullable=False,
            server_default=sa.text("'medium'"),
        ),
        sa.Column(
            "review_status",
            spoof_review_status_enum,
            nullable=False,
            server_default=sa.text("'new'"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            name="fk_spoof_alert_events_person_id_persons",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_media_asset_id"],
            ["media_assets.id"],
            name="fk_spoof_alert_events_snapshot_media_asset_id_media_assets",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("dedupe_key", name="uq_spoof_alert_events_dedupe_key"),
    )

    op.create_table(
        "event_inbox",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_name", sa.String(length=255), nullable=False),
        sa.Column("producer", sa.String(length=50), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'processed'"),
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.UniqueConstraint("message_id", name="uq_event_inbox_message_id"),
    )

    op.create_table(
        "auth_refresh_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_auth_refresh_tokens_user_id_users",
        ),
        sa.UniqueConstraint("token_hash", name="uq_auth_refresh_tokens_token_hash"),
    )

    op.create_table(
        "attendance_exceptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exception_type", attendance_exception_type_enum, nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_person_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_person_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("end_at >= start_at", name="ck_attendance_exceptions_time_range"),
        sa.ForeignKeyConstraint(
            ["created_by_person_id"],
            ["persons.id"],
            name="fk_attendance_exceptions_created_by_person_id_persons",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            name="fk_attendance_exceptions_person_id_persons",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by_person_id"],
            ["persons.id"],
            name="fk_attendance_exceptions_deleted_by_person_id_persons",
            ondelete="SET NULL",
        ),
    )

    op.create_index("ix_persons_department_id", "persons", ["department_id"])
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_media_assets_asset_type", "media_assets", ["asset_type"])
    op.create_index(
        "ix_face_registrations_person_id",
        "person_face_registrations",
        ["person_id"],
    )
    op.create_index(
        "ix_face_registrations_is_active",
        "person_face_registrations",
        ["is_active"],
    )
    op.create_index(
        "ix_recognition_events_person_id",
        "recognition_events",
        ["person_id"],
    )
    op.create_index(
        "ix_recognition_events_face_registration_id",
        "recognition_events",
        ["face_registration_id"],
    )
    op.create_index(
        "ix_recognition_events_recognized_at",
        "recognition_events",
        ["recognized_at"],
    )
    op.create_index("ix_recognition_events_dedupe_key", "recognition_events", ["dedupe_key"])
    op.create_index("ix_unknown_events_detected_at", "unknown_events", ["detected_at"])
    op.create_index("ix_unknown_events_dedupe_key", "unknown_events", ["dedupe_key"])
    op.create_index(
        "ix_unknown_events_review_status",
        "unknown_events",
        ["review_status"],
    )
    op.create_index(
        "ix_spoof_alert_events_person_id",
        "spoof_alert_events",
        ["person_id"],
    )
    op.create_index(
        "ix_spoof_alert_events_detected_at",
        "spoof_alert_events",
        ["detected_at"],
    )
    op.create_index(
        "ix_spoof_alert_events_review_status",
        "spoof_alert_events",
        ["review_status"],
    )
    op.create_index("ix_spoof_alert_events_dedupe_key", "spoof_alert_events", ["dedupe_key"])
    op.create_index("ix_event_inbox_message_id", "event_inbox", ["message_id"])
    op.create_index("ix_auth_refresh_tokens_user_id", "auth_refresh_tokens", ["user_id"])
    op.create_index("ix_auth_refresh_tokens_expires_at", "auth_refresh_tokens", ["expires_at"])
    op.create_index(
        "ix_attendance_exceptions_person_id",
        "attendance_exceptions",
        ["person_id"],
    )
    op.create_index(
        "ix_attendance_exceptions_work_date",
        "attendance_exceptions",
        ["work_date"],
    )
    op.create_index(
        "ix_attendance_exceptions_created_by_person_id",
        "attendance_exceptions",
        ["created_by_person_id"],
    )
    op.create_index(
        "ix_attendance_exceptions_is_deleted_work_date",
        "attendance_exceptions",
        ["is_deleted", "work_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_refresh_tokens_expires_at", table_name="auth_refresh_tokens")
    op.drop_index("ix_auth_refresh_tokens_user_id", table_name="auth_refresh_tokens")
    op.drop_table("auth_refresh_tokens")

    op.drop_index("ix_event_inbox_message_id", table_name="event_inbox")
    op.drop_table("event_inbox")

    op.drop_index("ix_spoof_alert_events_dedupe_key", table_name="spoof_alert_events")
    op.drop_index("ix_attendance_exceptions_is_deleted_work_date", table_name="attendance_exceptions")
    op.drop_index("ix_attendance_exceptions_created_by_person_id", table_name="attendance_exceptions")
    op.drop_index("ix_attendance_exceptions_work_date", table_name="attendance_exceptions")
    op.drop_index("ix_attendance_exceptions_person_id", table_name="attendance_exceptions")
    op.drop_table("attendance_exceptions")

    op.drop_index("ix_spoof_alert_events_review_status", table_name="spoof_alert_events")
    op.drop_index("ix_spoof_alert_events_detected_at", table_name="spoof_alert_events")
    op.drop_index("ix_spoof_alert_events_person_id", table_name="spoof_alert_events")
    op.drop_table("spoof_alert_events")

    op.drop_index("ix_unknown_events_dedupe_key", table_name="unknown_events")
    op.drop_index("ix_unknown_events_review_status", table_name="unknown_events")
    op.drop_index("ix_unknown_events_detected_at", table_name="unknown_events")
    op.drop_table("unknown_events")

    op.drop_index("ix_recognition_events_dedupe_key", table_name="recognition_events")
    op.drop_index("ix_recognition_events_recognized_at", table_name="recognition_events")
    op.drop_index("ix_recognition_events_face_registration_id", table_name="recognition_events")
    op.drop_index("ix_recognition_events_person_id", table_name="recognition_events")
    op.drop_table("recognition_events")

    op.drop_index("ix_face_registrations_is_active", table_name="person_face_registrations")
    op.drop_index("ix_face_registrations_person_id", table_name="person_face_registrations")
    op.drop_table("person_face_registrations")

    op.drop_index("ix_media_assets_asset_type", table_name="media_assets")
    op.drop_table("media_assets")

    op.drop_index("ix_persons_department_id", table_name="persons")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    op.drop_table("persons")
    op.drop_table("departments")

    bind = op.get_bind()
    attendance_exception_type_enum.drop(bind, checkfirst=True)
    spoof_review_status_enum.drop(bind, checkfirst=True)
    spoof_severity_enum.drop(bind, checkfirst=True)
    unknown_event_review_status_enum.drop(bind, checkfirst=True)
    event_direction_enum.drop(bind, checkfirst=True)
    registration_status_enum.drop(bind, checkfirst=True)
    media_asset_type_enum.drop(bind, checkfirst=True)
    storage_provider_enum.drop(bind, checkfirst=True)
    person_status_enum.drop(bind, checkfirst=True)
