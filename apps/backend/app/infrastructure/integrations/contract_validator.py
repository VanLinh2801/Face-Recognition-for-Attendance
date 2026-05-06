"""Validate inbound integration events against contracts in packages/contracts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import RefResolver, ValidationError as JsonSchemaValidationError
from jsonschema.validators import validator_for

from app.core.exceptions import InfrastructureError, ValidationError


class ContractValidator:
    """Validate integration envelopes against shared JSON schemas."""

    EVENT_SCHEMA_PATHS = {
        "recognition_event.detected": "ai_backend/recognition_event_detected.v1.schema.json",
        "unknown_event.detected": "ai_backend/unknown_event_detected.v1.schema.json",
        "spoof_alert.detected": "pipeline_backend/spoof_alert_detected.v1.schema.json",
        "frame_analysis.updated": "pipeline_backend/frame_analysis.updated.v1.schema.json",
        "registration_processing.completed": "ai_backend/registration_processing_completed.v1.schema.json",
        "registration_input.validated": "pipeline_backend/registration_input_validated.v1.schema.json",
    }

    PASSTHROUGH_EVENTS = {"stream.health.updated"}

    def __init__(self, contracts_root: Path | None = None) -> None:
        self._contracts_root = contracts_root or self._detect_contracts_root()
        self._schema_store = self._build_schema_store()
        self._validators = self._build_validators()

    def validate(self, envelope: dict[str, Any]) -> None:
        event_name = envelope.get("event_name")
        if not isinstance(event_name, str) or not event_name.strip():
            raise ValidationError("Missing event_name", details={"field": "event_name"})
        if event_name in self.PASSTHROUGH_EVENTS:
            return

        validator = self._validators.get(event_name)
        if validator is None:
            raise ValidationError(
                "Unsupported event contract",
                details={"event_name": event_name},
            )

        errors = sorted(validator.iter_errors(envelope), key=lambda item: list(item.absolute_path))
        if not errors:
            return

        first_error = errors[0]
        raise ValidationError(
            "Contract validation failed",
            details={
                "event_name": event_name,
                "message_id": str(envelope.get("message_id") or ""),
                "path": self._format_error_path(first_error),
                "error": first_error.message,
            },
        )

    def _build_schema_store(self) -> dict[str, dict[str, Any]]:
        store: dict[str, dict[str, Any]] = {}
        for schema_path in self._contracts_root.rglob("*.json"):
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            schema["$id"] = schema_path.resolve().as_uri()
            store[schema_path.resolve().as_uri()] = schema
        return store

    def _build_validators(self) -> dict[str, Any]:
        validators: dict[str, Any] = {}
        for event_name, relative_schema_path in self.EVENT_SCHEMA_PATHS.items():
            schema_path = self._contracts_root / relative_schema_path
            if not schema_path.exists():
                raise InfrastructureError(
                    "Contract schema file not found",
                    details={"event_name": event_name, "path": str(schema_path)},
                )
            schema = self._schema_store[schema_path.resolve().as_uri()]
            validator_cls = validator_for(schema)
            validator_cls.check_schema(schema)
            validators[event_name] = validator_cls(
                schema,
                resolver=RefResolver(
                    base_uri=schema_path.resolve().as_uri(),
                    referrer=schema,
                    store=self._schema_store,
                ),
            )
        return validators

    @staticmethod
    def _format_error_path(error: JsonSchemaValidationError) -> str:
        if not error.absolute_path:
            return "$"
        return "$." + ".".join(str(part) for part in error.absolute_path)

    @staticmethod
    def _detect_contracts_root() -> Path:
        current = Path(__file__).resolve()
        for parent in current.parents:
            candidate = parent / "packages" / "contracts"
            if candidate.exists():
                return candidate
        raise InfrastructureError("Unable to locate packages/contracts for contract validation")
