export type BackendErrorContext =
  | "auth"
  | "persons"
  | "departments"
  | "registrations"
  | "media"
  | "attendance"
  | "attendanceExceptions"
  | "unknownEvents"
  | "spoofEvents"
  | "events"
  | "realtime"
  | "system";

export type BackendErrorKey =
  | "auth.invalidCredentials"
  | "auth.invalidRefreshToken"
  | "auth.invalidAccessTokenSubject"
  | "auth.userNotFound"
  | "auth.currentPasswordIncorrect"
  | "auth.newPasswordSameAsCurrent"
  | "auth.newPasswordTooShort"
  | "auth.missingBearerToken"
  | "auth.invalidJwtPayload"
  | "auth.invalidJwtFormat"
  | "auth.invalidJwtSignature"
  | "auth.invalidJwtIssuer"
  | "auth.invalidJwtAudience"
  | "auth.invalidJwtExpiration"
  | "auth.jwtExpired"
  | "auth.unsupportedJwtAlgorithm"
  | "auth.invalidJwtSubject"
  | "auth.adminNotConfigured"
  | "auth.adminAccessRequired"
  | "auth.sessionExpired"
  | "persons.employeeCodeExists"
  | "persons.emailExists"
  | "persons.phoneExists"
  | "persons.notFound"
  | "persons.bulkDeleteEmpty"
  | "persons.inactiveStatusReserved"
  | "departments.codeExists"
  | "departments.parentNotFound"
  | "departments.notFound"
  | "departments.parentCannotBeSelf"
  | "departments.parentCannotBeDescendant"
  | "departments.codeEmpty"
  | "departments.nameEmpty"
  | "registrations.personNotFound"
  | "registrations.notFound"
  | "registrations.unsupportedImageType"
  | "registrations.emptyImage"
  | "registrations.imageTooLarge"
  | "registrations.bucketNameRequired"
  | "media.notFound"
  | "media.contentNotFound"
  | "media.unsupportedType"
  | "media.emptyFile"
  | "media.fileTooLarge"
  | "attendance.eventNotFound"
  | "attendance.filterFromTooEarly"
  | "attendance.filterToTooLate"
  | "attendance.filterRangeInvalid"
  | "attendanceExceptions.endBeforeStart"
  | "attendanceExceptions.workDateOutOfRange"
  | "attendanceExceptions.notFound"
  | "attendanceExceptions.bulkDeleteEmpty"
  | "unknownEvents.notFound"
  | "unknownEvents.noFieldsProvided"
  | "spoofEvents.notFound"
  | "spoofEvents.noFieldsProvided"
  | "events.filterFromTooEarly"
  | "events.filterToTooLate"
  | "events.filterRangeInvalid"
  | "realtime.invalidChannel"
  | "realtime.invalidSinceTimestamp"
  | "realtime.serverOverloaded"
  | "realtime.authOrChannelRejected"
  | "contracts.missingEventName"
  | "contracts.unsupportedEventContract"
  | "contracts.validationFailed"
  | "contracts.schemaFileNotFound"
  | "contracts.contractsRootNotFound"
  | "ingestion.invalidPayload"
  | "ingestion.missingRequiredField"
  | "ingestion.invalidUuidField"
  | "ingestion.invalidDatetimeField"
  | "system.databaseUnreachable"
  | "system.validationError"
  | "system.notFound"
  | "system.conflict"
  | "system.infrastructureError"
  | "system.internalError"
  | "system.requestFailed";

export type NormalizedBackendError = {
  key: BackendErrorKey;
  fallbackMessage: string;
  status?: number;
  code?: string;
  message?: string;
  detail?: string;
  details?: unknown;
  raw: unknown;
};

type BackendErrorShape = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  details?: unknown;
  reason?: unknown;
};

const EXACT_MESSAGE_KEYS: Record<string, BackendErrorKey> = {
  "session_expired::": "auth.sessionExpired",
  "validation_error::Invalid credentials": "auth.invalidCredentials",
  "validation_error::Invalid refresh token": "auth.invalidRefreshToken",
  "validation_error::Invalid access token subject": "auth.invalidAccessTokenSubject",
  "validation_error::User not found": "auth.userNotFound",
  "validation_error::Current password is incorrect": "auth.currentPasswordIncorrect",
  "validation_error::New password must be different from the current password": "auth.newPasswordSameAsCurrent",
  "validation_error::New password must be at least 8 characters": "auth.newPasswordTooShort",
  "validation_error::Missing bearer token": "auth.missingBearerToken",
  "validation_error::Invalid JWT payload": "auth.invalidJwtPayload",
  "validation_error::Invalid JWT format": "auth.invalidJwtFormat",
  "validation_error::Invalid JWT signature": "auth.invalidJwtSignature",
  "validation_error::Invalid JWT issuer": "auth.invalidJwtIssuer",
  "validation_error::Invalid JWT audience": "auth.invalidJwtAudience",
  "validation_error::Invalid JWT expiration": "auth.invalidJwtExpiration",
  "validation_error::JWT expired": "auth.jwtExpired",
  "validation_error::Unsupported JWT algorithm": "auth.unsupportedJwtAlgorithm",
  "validation_error::Invalid JWT subject": "auth.invalidJwtSubject",
  "validation_error::Admin account is not configured": "auth.adminNotConfigured",
  "validation_error::Admin access required": "auth.adminAccessRequired",
  "validation_error::employee_code already exists": "persons.employeeCodeExists",
  "validation_error::email already exists": "persons.emailExists",
  "validation_error::phone already exists": "persons.phoneExists",
  "validation_error::person_ids cannot be empty": "persons.bulkDeleteEmpty",
  "validation_error::inactive status is reserved for deleted persons": "persons.inactiveStatusReserved",
  "validation_error::department code already exists": "departments.codeExists",
  "validation_error::parent department not found": "departments.parentNotFound",
  "validation_error::department cannot be parent of itself": "departments.parentCannotBeSelf",
  "validation_error::parent department cannot be a descendant": "departments.parentCannotBeDescendant",
  "validation_error::code cannot be empty": "departments.codeEmpty",
  "validation_error::name cannot be empty": "departments.nameEmpty",
  "validation_error::unsupported media type": "media.unsupportedType",
  "validation_error::file cannot be empty": "media.emptyFile",
  "validation_error::file is too large": "media.fileTooLarge",
  "validation_error::attendance from_at must be on or before to_at": "attendance.filterRangeInvalid",
  "validation_error::end_at must be greater than or equal to start_at": "attendanceExceptions.endBeforeStart",
  "validation_error::work_date must be within start_at and end_at range": "attendanceExceptions.workDateOutOfRange",
  "validation_error::exception_ids cannot be empty": "attendanceExceptions.bulkDeleteEmpty",
  "validation_error::events from_at must be on or before to_at": "events.filterRangeInvalid",
  "validation_error::Invalid channel": "realtime.invalidChannel",
  "validation_error::Invalid since_timestamp": "realtime.invalidSinceTimestamp",
  "validation_error::Missing event_name": "contracts.missingEventName",
  "validation_error::Unsupported event contract": "contracts.unsupportedEventContract",
  "validation_error::Contract validation failed": "contracts.validationFailed",
  "validation_error::Invalid payload": "ingestion.invalidPayload",
  "infrastructure_error::Contract schema file not found": "contracts.schemaFileNotFound",
  "infrastructure_error::Unable to locate packages/contracts for contract validation": "contracts.contractsRootNotFound",
  "infrastructure_error::Database is not reachable": "system.databaseUnreachable",
  "internal_error::Internal server error": "system.internalError",
};

const DETAIL_KEYS: Record<string, BackendErrorKey> = {
  "Registration image is empty": "registrations.emptyImage",
  "Registration image is too large": "registrations.imageTooLarge",
  "Bucket name is required": "registrations.bucketNameRequired",
};

export function normalizeBackendError(
  error: unknown,
  context?: BackendErrorContext,
): NormalizedBackendError {
  const shape = getErrorShape(error);
  const status = toNumber(shape.status);
  const code = toStringValue(shape.code);
  const message = toStringValue(shape.message);
  const detail = toStringValue(shape.detail);
  const reason = toStringValue(shape.reason);
  const details = shape.details;
  const text = detail ?? reason ?? message;
  const key = resolveBackendErrorKey({ status, code, message, detail, reason, context });

  return {
    key,
    fallbackMessage: text ?? fallbackMessageForStatus(status),
    status,
    code,
    message,
    detail,
    details,
    raw: error,
  };
}

export function getBackendErrorFallbackMessage(
  error: unknown,
  fallback = "Request failed. Please try again.",
  context?: BackendErrorContext,
) {
  const normalized = normalizeBackendError(error, context);
  if (normalized.key === "system.requestFailed" || normalized.key === "system.internalError") {
    return normalized.message ?? normalized.detail ?? fallback;
  }
  return normalized.fallbackMessage;
}

function resolveBackendErrorKey({
  status,
  code,
  message,
  detail,
  reason,
  context,
}: {
  status?: number;
  code?: string;
  message?: string;
  detail?: string;
  reason?: string;
  context?: BackendErrorContext;
}): BackendErrorKey {
  const exactKey = EXACT_MESSAGE_KEYS[`${code ?? ""}::${message ?? ""}`];
  if (exactKey) {
    return disambiguateKey(exactKey, message, context);
  }

  if (detail) {
    const detailKey = DETAIL_KEYS[detail];
    if (detailKey) return detailKey;
    if (detail.startsWith("Unsupported image type:")) return "registrations.unsupportedImageType";
  }

  const text = reason ?? message ?? detail ?? "";
  if (reason === "server overloaded" || status === 1013) return "realtime.serverOverloaded";
  if (reason) return resolveReasonKey(reason);

  if (code === "not_found") return resolveNotFoundKey(message, context);
  if (code === "session_expired") return "auth.sessionExpired";
  if (code === "validation_error") return resolveValidationKey(message, context);
  if (code === "conflict") return "system.conflict";
  if (code === "infrastructure_error") return "system.infrastructureError";
  if (code === "internal_error") return "system.internalError";

  if (text.startsWith("Unsupported image type:")) return "registrations.unsupportedImageType";
  return resolveStatusKey(status);
}

function disambiguateKey(
  key: BackendErrorKey,
  message: string | undefined,
  context: BackendErrorContext | undefined,
) {
  if (message === "At least one field must be provided") {
    if (context === "spoofEvents") return "spoofEvents.noFieldsProvided";
    return "unknownEvents.noFieldsProvided";
  }
  if (key === "persons.notFound" && context === "registrations") return "registrations.personNotFound";
  return key;
}

function resolveReasonKey(reason: string): BackendErrorKey {
  const authReason = EXACT_MESSAGE_KEYS[`validation_error::${reason}`];
  if (authReason) return authReason;
  if (reason === "Invalid channel") return "realtime.invalidChannel";
  return "realtime.authOrChannelRejected";
}

function resolveNotFoundKey(message: string | undefined, context: BackendErrorContext | undefined): BackendErrorKey {
  if (message === "Person not found" && context === "registrations") return "registrations.personNotFound";
  if (message === "Person not found") return "persons.notFound";
  if (message === "Department not found") return "departments.notFound";
  if (message === "Registration not found") return "registrations.notFound";
  if (message === "Media asset not found") return "media.notFound";
  if (message === "Media asset content not found") return "media.contentNotFound";
  if (message === "Attendance event not found") return "attendance.eventNotFound";
  if (message === "Attendance exception not found") return "attendanceExceptions.notFound";
  if (message === "Unknown event not found") return "unknownEvents.notFound";
  if (message === "Spoof alert event not found") return "spoofEvents.notFound";
  return "system.notFound";
}

function resolveValidationKey(message: string | undefined, context: BackendErrorContext | undefined): BackendErrorKey {
  if (!message) return "system.validationError";
  if (message === "At least one field must be provided") {
    return context === "spoofEvents" ? "spoofEvents.noFieldsProvided" : "unknownEvents.noFieldsProvided";
  }
  if (message.startsWith("attendance from_at must be on or after ")) return "attendance.filterFromTooEarly";
  if (message.startsWith("attendance to_at must be on or before ")) return "attendance.filterToTooLate";
  if (message.startsWith("events from_at must be on or after ")) return "events.filterFromTooEarly";
  if (message.startsWith("events to_at must be on or before ")) return "events.filterToTooLate";
  if (message.startsWith("Missing required field: ")) return "ingestion.missingRequiredField";
  if (message.startsWith("Invalid UUID field: ")) return "ingestion.invalidUuidField";
  if (message.startsWith("Invalid datetime field: ")) return "ingestion.invalidDatetimeField";
  return "system.validationError";
}

function resolveStatusKey(status: number | undefined): BackendErrorKey {
  if (status === 404) return "system.notFound";
  if (status === 409) return "system.conflict";
  if (status === 422 || status === 400 || status === 413 || status === 415) return "system.validationError";
  if (status && status >= 500) return "system.internalError";
  return "system.requestFailed";
}

function getErrorShape(error: unknown): BackendErrorShape {
  if (isObject(error)) return error as BackendErrorShape;
  if (typeof error === "string") return { message: error };
  return {};
}

function toStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function fallbackMessageForStatus(status: number | undefined) {
  return status ? `Request failed (${status})` : "Request failed. Please try again.";
}

function isObject(value: unknown) {
  return typeof value === "object" && value !== null;
}
