# Backend Authentication and Token Lifecycle

## Muc tieu
- Ho tro dang nhap admin bang username/password.
- Cap phat `access token` de goi API/WS.
- Cap phat va quan ly `refresh token` de gia han phien.

## Endpoint auth
- `POST /api/v1/auth/login`
  - Input: `username`, `password`
  - Output: `access_token`, `refresh_token`, `token_type`, `expires_in`
- `POST /api/v1/auth/refresh`
  - Input: `refresh_token`
  - Output: access token moi (giu nguyen refresh token hien tai)
- `POST /api/v1/auth/logout`
  - Input: `refresh_token`
  - Action: revoke refresh token
- `GET /api/v1/auth/me`
  - Header: `Authorization: Bearer <access_token>`
  - Output: thong tin user hien tai

## Mo hinh du lieu
- `users`
  - `id`, `username`, `password_hash`, `is_active`, `last_login_at`, `created_at`, `updated_at`
- `auth_refresh_tokens`
  - `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `last_used_at`

Refresh token duoc luu dang hash (`sha256`) trong DB, khong luu plain token.

## Cach backend xac thuc token
- Access token dung JWT HS256.
- Validate claim:
  - `iss == JWT_ISSUER`
  - `aud` co `JWT_AUDIENCE`
  - `exp` chua het han
  - `sub` hop le
- WS endpoint va API deu dung chung verify path.

## Bien moi truong lien quan
- `JWT_ALGORITHM`
- `JWT_SECRET_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_ACCESS_EXPIRES_SECONDS`
- `JWT_REFRESH_EXPIRES_SECONDS`
- `AUTH_BCRYPT_ROUNDS`
- `AUTH_SEED_ADMIN_USERNAME`
- `AUTH_SEED_ADMIN_PASSWORD`

## Seed admin
- Script: `apps/backend/scripts/seed_admin.py`
- Co the set env `AUTH_SEED_ADMIN_USERNAME` + `AUTH_SEED_ADMIN_PASSWORD` de tao tai khoan admin dau tien.
- Startup cung co bootstrap auto neu env duoc set va user chua ton tai.

## Frontend flow de su dung token
1. Goi `POST /api/v1/auth/login` -> lay `access_token` + `refresh_token`.
2. Goi REST API voi header `Authorization: Bearer <access_token>`.
3. Ket noi WS voi `token=<access_token>` hoac bearer header.
4. Khi access token het han, goi `POST /api/v1/auth/refresh`.
5. Khi logout, goi `POST /api/v1/auth/logout` de revoke refresh token.

## Ghi chu bao mat
- Luon hash password bang bcrypt, khong luu plaintext.
- Khong log token/password.
- Dung HTTPS cho moi endpoint auth va websocket trong production.
