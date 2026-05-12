# Backend deployment

This guide covers deploying the FastAPI backend after the cloud PostgreSQL database is ready.

## 1. Required secrets

Set these environment variables in your hosting provider:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
SECRET_KEY=replace-with-a-long-random-secret
OPENAI_API_KEY=replace-with-real-openai-key
BACKEND_CORS_ORIGINS=["*"]
```

For a stricter production setup, replace `["*"]` with explicit frontend/admin origins:

```bash
BACKEND_CORS_ORIGINS=["https://your-admin-domain.example"]
```

If your database provider requires SSL but the URL does not include `sslmode`, set:

```bash
DB_SSL_MODE=require
```

## 2. Docker deployment

Use `backend/Dockerfile` as the service image. The container:

- installs backend dependencies from `requirements.docker.txt`
- runs `alembic upgrade head` on startup
- starts Uvicorn on the cloud-provided `PORT`, falling back to `8000`
- exposes `/health` for platform health checks

Typical service settings:

```text
Root directory: backend
Dockerfile: Dockerfile
Health check path: /health
```

Do not commit real `.env` files or database URLs. Configure secrets only in the provider dashboard.

## 3. Verify deployment

After the service is live, check:

```bash
curl https://your-backend.example.com/health
curl https://your-backend.example.com/health/db
curl https://your-backend.example.com/
```

Expected responses:

```json
{"status":"ok"}
{"status":"ok","database":"available"}
{"message":"SelfMind Pro API is running"}
```

If `/health` works but `/health/db` returns `503`, the app is running but cannot connect to PostgreSQL. Re-check `DATABASE_URL`, `DB_SSL_MODE`, provider allowlists, and whether migrations completed.

## 4. Mobile configuration

Point Expo to the deployed backend base URL without `/api/v1`:

```bash
EXPO_PUBLIC_API_URL=https://your-backend.example.com
```

The mobile API client appends `/api/v1` automatically.

Restart Expo after changing environment variables.
