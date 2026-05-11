from typing import Final

ROLE_USER: Final = "user"
ROLE_MODERATOR: Final = "moderator"
ROLE_ADMIN: Final = "admin"

USER_ROLES: Final = {ROLE_USER, ROLE_MODERATOR, ROLE_ADMIN}
ADMIN_ROLES: Final = {ROLE_ADMIN}
MODERATOR_ROLES: Final = {ROLE_ADMIN, ROLE_MODERATOR}


def is_admin(role: str | None) -> bool:
    return role == ROLE_ADMIN


def is_moderator_or_admin(role: str | None) -> bool:
    return role in MODERATOR_ROLES
