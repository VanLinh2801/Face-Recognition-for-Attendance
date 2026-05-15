# Backend Error Catalog For Frontend

Mục tiêu của tài liệu này là liệt kê các loại lỗi backend hiện đang phát ra trong repo, để frontend có thể:

- chuẩn hóa xử lý lỗi;
- map lỗi sang translation key ổn định;
- tránh phụ thuộc trực tiếp vào raw English message.

Ngày rà soát: 2026-05-15

## 1. Transport hiện tại của backend

### 1.1 Error envelope chuẩn

Phần lớn API backend trả lỗi theo schema:

```json
{
  "code": "validation_error",
  "message": "Invalid credentials",
  "details": null
}
```

Nguồn:

- `apps/backend/app/core/exceptions.py`
- `apps/backend/app/main.py`
- `apps/backend/app/presentation/schemas/common.py`

### 1.2 Mapping status code hiện tại

`AppError` đang được map như sau:

- `not_found` -> HTTP `404`
- `validation_error` -> HTTP `422`
- `conflict` -> HTTP `409`
- `infrastructure_error` -> HTTP `500`
- unhandled exception -> HTTP `500` với `code = "internal_error"`

### 1.3 Các ngoại lệ chưa theo envelope chuẩn

Hiện có một số chỗ chưa trả `ErrorResponse` thống nhất:

- `POST /persons/{person_id}/registrations/upload`
  - dùng `HTTPException`
  - response mặc định có dạng:

```json
{
  "detail": "Registration image is too large"
}
```

- WebSocket `/ws/v1/realtime`
  - lỗi trả qua `WebSocketException`
  - frontend chỉ nhận `close code` + `reason`

Điều này có nghĩa là frontend hiện tại cần support 3 dạng:

1. `{ code, message, details }`
2. `{ detail }`
3. WebSocket close `reason`

## 2. Nguyên tắc frontend nên dùng

Trong trạng thái hiện tại của backend, frontend nên normalize lỗi theo thứ tự:

1. Nếu có `code` + `message`: match theo cặp này.
2. Nếu có `detail`: match theo `detail`.
3. Nếu là WebSocket close reason: match theo `reason`.
4. Nếu không match được: fallback về generic key theo HTTP status hoặc `code`.

Khuyến nghị:

- Không hiển thị trực tiếp `message` hoặc `detail` cho người dùng cuối nếu đã có mapping nội bộ.
- Dùng một lớp normalize ở frontend, ví dụ:
  - input: response error từ API/WebSocket
  - output: `frontendErrorKey` như `auth.invalidCredentials`

## 3. Phân loại lỗi backend hiện có

## 3.1 Auth và session

Các lỗi đã thấy:

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `auth.invalidCredentials` | `code=validation_error`, `message="Invalid credentials"` | Đăng nhập sai tài khoản/mật khẩu |
| `auth.invalidRefreshToken` | `code=validation_error`, `message="Invalid refresh token"` | Refresh token sai, hết hạn, bị revoke |
| `auth.invalidAccessTokenSubject` | `code=validation_error`, `message="Invalid access token subject"` | Subject trong access token không parse được UUID |
| `auth.userNotFound` | `code=validation_error`, `message="User not found"` | User trong token không còn hợp lệ/không active |
| `auth.currentPasswordIncorrect` | `code=validation_error`, `message="Current password is incorrect"` | Đổi mật khẩu |
| `auth.newPasswordSameAsCurrent` | `code=validation_error`, `message="New password must be different from the current password"` | Đổi mật khẩu |
| `auth.newPasswordTooShort` | `code=validation_error`, `message="New password must be at least 8 characters"` | Đổi mật khẩu |
| `auth.missingBearerToken` | `code=validation_error`, `message="Missing bearer token"` | Thiếu token ở API hoặc websocket auth |
| `auth.invalidJwtPayload` | `code=validation_error`, `message="Invalid JWT payload"` | Token hỏng payload |
| `auth.invalidJwtFormat` | `code=validation_error`, `message="Invalid JWT format"` | Token sai format |
| `auth.invalidJwtSignature` | `code=validation_error`, `message="Invalid JWT signature"` | Token sai chữ ký |
| `auth.invalidJwtIssuer` | `code=validation_error`, `message="Invalid JWT issuer"` | Sai issuer |
| `auth.invalidJwtAudience` | `code=validation_error`, `message="Invalid JWT audience"` | Sai audience |
| `auth.invalidJwtExpiration` | `code=validation_error`, `message="Invalid JWT expiration"` | Claim `exp` không hợp lệ |
| `auth.jwtExpired` | `code=validation_error`, `message="JWT expired"` | Frontend nên dùng key riêng vì đây là case quan trọng |
| `auth.unsupportedJwtAlgorithm` | `code=validation_error`, `message="Unsupported JWT algorithm"` | Lỗi cấu hình/hệ thống |
| `auth.invalidJwtSubject` | `code=validation_error`, `message="Invalid JWT subject"` | Claim `sub` không hợp lệ |
| `auth.adminNotConfigured` | `code=validation_error`, `message="Admin account is not configured"` | Cấu hình môi trường |
| `auth.adminAccessRequired` | `code=validation_error`, `message="Admin access required"` | Có thể có `details.username` |

## 3.2 Persons

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `persons.employeeCodeExists` | `code=validation_error`, `message="employee_code already exists"` | Có `details.employee_code` |
| `persons.emailExists` | `code=validation_error`, `message="email already exists"` | Có `details.email` |
| `persons.phoneExists` | `code=validation_error`, `message="phone already exists"` | Có `details.phone` |
| `persons.notFound` | `code=not_found`, `message="Person not found"` | Dùng cho get/update/delete |
| `persons.bulkDeleteEmpty` | `code=validation_error`, `message="person_ids cannot be empty"` | Xóa nhiều |
| `persons.inactiveStatusReserved` | `code=validation_error`, `message="inactive status is reserved for deleted persons"` | Có `details.status` |

## 3.3 Departments

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `departments.codeExists` | `code=validation_error`, `message="department code already exists"` | Có `details.code` |
| `departments.parentNotFound` | `code=validation_error`, `message="parent department not found"` | Có `details.parent_id` |
| `departments.notFound` | `code=not_found`, `message="Department not found"` | Get/update/delete/list persons |
| `departments.parentCannotBeSelf` | `code=validation_error`, `message="department cannot be parent of itself"` | Có `details.parent_id` |
| `departments.parentCannotBeDescendant` | `code=validation_error`, `message="parent department cannot be a descendant"` | Có `details.parent_id` |
| `departments.codeEmpty` | `code=validation_error`, `message="code cannot be empty"` | Có `details.code` |
| `departments.nameEmpty` | `code=validation_error`, `message="name cannot be empty"` | Có `details.name` |

## 3.4 Face registrations

### Errors theo `ErrorResponse`

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `registrations.personNotFound` | `code=not_found`, `message="Person not found"` | Tạo đăng ký cho person không tồn tại |
| `registrations.notFound` | `code=not_found`, `message="Registration not found"` | Get/delete/complete |

### Errors theo `HTTPException.detail`

Các lỗi dưới đây hiện không đi qua `ErrorResponse`:

| Frontend key đề xuất | HTTP status | `detail` hiện tại |
| --- | --- | --- |
| `registrations.unsupportedImageType` | `415` | `Unsupported image type: {content_type}` |
| `registrations.emptyImage` | `400` | `Registration image is empty` |
| `registrations.imageTooLarge` | `413` | `Registration image is too large` |
| `registrations.bucketNameRequired` | `400` | `Bucket name is required` |

Lưu ý:

- `registrations.unsupportedImageType` có dynamic suffix nên frontend nên match bằng prefix `Unsupported image type:`.

## 3.5 Media assets

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `media.notFound` | `code=not_found`, `message="Media asset not found"` | Get asset/presigned URL |
| `media.contentNotFound` | `code=not_found`, `message="Media asset content not found"` | Object trong storage không còn |
| `media.unsupportedType` | `code=validation_error`, `message="unsupported media type"` | Có `details.mime_type` |
| `media.emptyFile` | `code=validation_error`, `message="file cannot be empty"` | Có `details.file_size` |
| `media.fileTooLarge` | `code=validation_error`, `message="file is too large"` | Có `details.max_bytes` |

## 3.6 Attendance

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `attendance.eventNotFound` | `code=not_found`, `message="Attendance event not found"` | Chi tiết event |
| `attendance.filterFromTooEarly` | `code=validation_error`, message bắt đầu bằng `"attendance from_at must be on or after "` | Có `details.min_allowed`, `details.max_allowed` |
| `attendance.filterToTooLate` | `code=validation_error`, message bắt đầu bằng `"attendance to_at must be on or before "` | Có `details.min_allowed`, `details.max_allowed` |
| `attendance.filterRangeInvalid` | `code=validation_error`, `message="attendance from_at must be on or before to_at"` | Có `details.min_allowed`, `details.max_allowed` |

## 3.7 Attendance exceptions

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `attendanceExceptions.endBeforeStart` | `code=validation_error`, `message="end_at must be greater than or equal to start_at"` | Create/update |
| `attendanceExceptions.workDateOutOfRange` | `code=validation_error`, `message="work_date must be within start_at and end_at range"` | Create |
| `attendanceExceptions.notFound` | `code=not_found`, `message="Attendance exception not found"` | Get/update/delete |
| `attendanceExceptions.bulkDeleteEmpty` | `code=validation_error`, `message="exception_ids cannot be empty"` | Xóa nhiều |

## 3.8 Events review: unknown và spoof

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `unknownEvents.notFound` | `code=not_found`, `message="Unknown event not found"` | |
| `unknownEvents.noFieldsProvided` | `code=validation_error`, `message="At least one field must be provided"` | Update review |
| `spoofEvents.notFound` | `code=not_found`, `message="Spoof alert event not found"` | |
| `spoofEvents.noFieldsProvided` | `code=validation_error`, `message="At least one field must be provided"` | Update review |

Lưu ý:

- cùng một message `"At least one field must be provided"` xuất hiện ở cả unknown/spoof;
- frontend nên kết hợp message với endpoint context hoặc module gọi API để ra key đúng.

## 3.9 Event feed / realtime catchup filters

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `events.filterFromTooEarly` | `code=validation_error`, message bắt đầu bằng `"events from_at must be on or after "` | Có `details.min_allowed`, `details.max_allowed` |
| `events.filterToTooLate` | `code=validation_error`, message bắt đầu bằng `"events to_at must be on or before "` | Có `details.min_allowed`, `details.max_allowed` |
| `events.filterRangeInvalid` | `code=validation_error`, `message="events from_at must be on or before to_at"` | Có `details.min_allowed`, `details.max_allowed` |
| `realtime.invalidChannel` | `code=validation_error`, `message="Invalid channel"` | Catchup API và websocket parse |
| `realtime.invalidSinceTimestamp` | `code=validation_error`, `message="Invalid since_timestamp"` | Catchup API |

### WebSocket close reasons

| Frontend key đề xuất | Close code / reason | Ghi chú |
| --- | --- | --- |
| `realtime.serverOverloaded` | close code `1013`, reason `"server overloaded"` | Từ websocket hub |
| `realtime.authOrChannelRejected` | close code `1008`, reason là một trong các auth/channel validation message | Có thể map tiếp theo `reason` cụ thể |

## 3.10 Integration contracts và event ingestion

Nhóm này quan trọng nếu frontend gọi các API internal hoặc cần hiển thị lỗi đồng bộ pipeline.

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `contracts.missingEventName` | `code=validation_error`, `message="Missing event_name"` | Có `details.field=event_name` |
| `contracts.unsupportedEventContract` | `code=validation_error`, `message="Unsupported event contract"` | Có `details.event_name` |
| `contracts.validationFailed` | `code=validation_error`, `message="Contract validation failed"` | Có `details.path`, `details.error`, `details.event_name` |
| `contracts.schemaFileNotFound` | `code=infrastructure_error`, `message="Contract schema file not found"` | Lỗi deploy/cấu hình |
| `contracts.contractsRootNotFound` | `code=infrastructure_error`, `message="Unable to locate packages/contracts for contract validation"` | Lỗi deploy/cấu hình |
| `ingestion.invalidPayload` | `code=validation_error`, `message="Invalid payload"` | Recognition/unknown/spoof ingest |
| `ingestion.missingRequiredField` | `code=validation_error`, message bắt đầu bằng `"Missing required field: "` | |
| `ingestion.invalidUuidField` | `code=validation_error`, message bắt đầu bằng `"Invalid UUID field: "` | |
| `ingestion.invalidDatetimeField` | `code=validation_error`, message bắt đầu bằng `"Invalid datetime field: "` | |

## 3.11 System và infrastructure

| Frontend key đề xuất | Backend signature hiện tại | Ghi chú |
| --- | --- | --- |
| `system.databaseUnreachable` | `code=infrastructure_error`, `message="Database is not reachable"` | Health/readiness |
| `system.internalError` | `code=internal_error`, `message="Internal server error"` | Generic fallback |

## 4. Các non-error status nên biết

Đây không phải HTTP error, nhưng là trạng thái backend có thể quan trọng nếu sau này frontend đọc dữ liệu ingestion nội bộ:

| Domain | Status | Reason |
| --- | --- | --- |
| Event ingestion | `duplicate` | `message_id` |
| Event ingestion | `duplicate` | `dedupe_key` |
| Event ingestion | `ignored` | `throttled` |
| Event ingestion | `processed` | `null` |

Hiện chúng là business result trong backend, không phải API error chuẩn cho frontend admin hiện tại.

## 5. Kế hoạch normalize tối thiểu ở frontend

Frontend nên có một hàm normalize, ví dụ:

```ts
type NormalizedFrontendErrorKey =
  | "auth.invalidCredentials"
  | "auth.jwtExpired"
  | "persons.employeeCodeExists"
  | "departments.parentCannotBeDescendant"
  | "registrations.imageTooLarge"
  | "system.internalError";
```

Pseudo-flow:

```ts
function normalizeBackendError(error: unknown): string {
  // 1. envelope chuẩn
  // 2. upload detail-only
  // 3. websocket reason
  // 4. fallback theo status/code
}
```

Thứ tự match đề xuất:

1. `code + exact message`
2. `detail + exact/prefix match`
3. `websocket reason`
4. `code only`
5. `http status`
6. generic fallback

## 6. Khuyến nghị backend cho bước sau

Để frontend i18n sạch hơn, backend nên tiến tới trả `code` chi tiết thay vì chỉ `validation_error`/`not_found`.

Ví dụ:

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_JWT_EXPIRED`
- `PERSON_EMPLOYEE_CODE_EXISTS`
- `DEPARTMENT_PARENT_IS_DESCENDANT`
- `REGISTRATION_IMAGE_TOO_LARGE`

Khi đó frontend chỉ cần map theo `code`, không cần match raw English message nữa.

## 7. Kết luận thực dụng

Hiện tại frontend vẫn có thể làm i18n ổn nếu:

- normalize lỗi ở một chỗ duy nhất;
- match theo `code + message` cho các lỗi `AppError`;
- có nhánh riêng cho `detail` ở upload registration;
- có nhánh riêng cho WebSocket close `reason`.

Tài liệu này nên được xem là contract tạm thời giữa backend và frontend cho đến khi backend có bộ error code chi tiết hơn.
