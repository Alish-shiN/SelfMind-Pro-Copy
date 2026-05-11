# Roles and RBAC model

SelfMind Pro uses three backend roles:

| Role | Scope |
| --- | --- |
| `user` | Uses the mobile product and can manage only their own private/user-created data. |
| `moderator` | Can access moderation and safety review workflows and can remove community content. |
| `admin` | Full system management: users, analytics, roles/status, content, moderation, and reports. |

## Enforcement points

- JWT authentication resolves the current user and blocks deactivated accounts.
- `get_current_admin` allows only `admin`.
- `get_current_moderator` allows `admin` and `moderator`.
- Community delete operations allow the content owner, moderators, or admins.
- Admin user-management actions prevent accidental lockout:
  - an admin cannot deactivate their own account;
  - an admin cannot remove their own admin role;
  - the system must keep at least one active admin.
- Database check constraints reject unsupported role, moderation status, and admin content type values.

## First admin bootstrap

The first admin still needs to be promoted directly in the database after registration:

```sql
update users
set role = 'admin'
where email = 'admin@test.com';
```

After that, admins can manage roles through `/api/v1/admin/users/{user_id}/role`.

## Useful API checks

```http
GET /api/v1/users/me
GET /api/v1/admin/users
PATCH /api/v1/admin/users/{user_id}/role
PATCH /api/v1/admin/users/{user_id}/status
GET /api/v1/admin/moderation/posts
GET /api/v1/admin/safety/risk-items
```
