# Backend Structure

Scaffold cho backend theo clean architecture.

Các tầng chính:

- `app/domain`: business entities, value objects, enums
- `app/application`: use cases và abstraction cho repository/gateway
- `app/infrastructure`: ORM, persistence, storage, vector DB, integrations
- `app/presentation`: API router và request/response schema
- `migrations`: Alembic migration files

Trạng thái hiện tại: đây là skeleton thư mục để bắt đầu implementation phase 1.
