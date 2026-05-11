# Cloud PostgreSQL setup

This project can run with either local PostgreSQL (`POSTGRES_*` variables) or a single cloud connection string (`DATABASE_URL`). Use `DATABASE_URL` for production/staging deployments on Supabase, Neon, Railway, Render, or similar providers.

## 1. Create a cloud database

Recommended options for a diploma demo:

- Supabase Postgres
- Neon
- Railway Postgres
- Render PostgreSQL

Create separate databases/projects for environments when possible:

- `selfmind_dev`
- `selfmind_stage`
- `selfmind_prod`

## 2. Configure backend secrets

In your hosting provider's environment variables / secrets panel, set:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
SECRET_KEY=replace-with-long-random-secret
OPENAI_API_KEY=replace-with-real-key
BACKEND_CORS_ORIGINS=["https://your-admin-or-api-domain.example"]
```

If your provider gives a `postgres://...` URL, it is accepted: the backend normalizes it to SQLAlchemy's `postgresql://...` scheme automatically.

If the provider requires SSL and the URL does not include `sslmode`, set:

```bash
DB_SSL_MODE=require
```

`DATABASE_URL` has priority over `POSTGRES_SERVER`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.

## 3. Run migrations against cloud DB

From `backend/`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require" \
SECRET_KEY="temporary-secret" \
OPENAI_API_KEY="temporary-key" \
alembic upgrade head
```

On Docker/Render/Railway-style deployments, the Docker command already runs:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 4. Verify the API is using the cloud database

Start the backend with the same `DATABASE_URL` and call:

```bash
curl http://127.0.0.1:8000/
```

Then register a test user and confirm it appears in the cloud provider's SQL editor:

```sql
select id, email, username, role, is_active, created_at
from users
order by id desc
limit 5;
```

## 5. Backups

Install PostgreSQL client tools locally (`pg_dump` must be available), then run:

```bash
cd backend
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require" \
BACKUP_DIR="./backups" \
./scripts/backup_postgres.sh
```

The script creates a custom-format dump (`.dump`). Restore example:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" ./backups/selfmind_YYYYMMDDTHHMMSSZ.dump
```

For production, schedule this script with cron/GitHub Actions/provider jobs and store dumps in private object storage. Never commit backups or `.env` files to Git.

## 6. Mobile app configuration

After deploying the backend, point the Expo app to the deployed API URL:

```bash
EXPO_PUBLIC_API_URL=https://your-backend.example.com
```

The mobile API client appends `/api/v1` automatically.
