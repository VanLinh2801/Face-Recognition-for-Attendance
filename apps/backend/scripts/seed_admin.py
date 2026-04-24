"""Seed initial admin user for local environments."""

from __future__ import annotations

from app.bootstrap.container import build_container
from app.core.security import hash_password
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository


def main() -> None:
    container = build_container()
    username = container.settings.auth_seed_admin_username
    password = container.settings.auth_seed_admin_password
    if not username or not password:
        raise SystemExit("AUTH_SEED_ADMIN_USERNAME/AUTH_SEED_ADMIN_PASSWORD are required")
    with container.session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        if repo.get_by_username(username) is not None:
            print(f"Admin '{username}' already exists")
            return
        repo.create_user(username=username, password_hash=hash_password(password, container.settings.auth_bcrypt_rounds))
        session.commit()
        print(f"Seeded admin user '{username}'")


if __name__ == "__main__":
    main()
