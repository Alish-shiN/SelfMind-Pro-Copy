#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

if [[ -n "${DATABASE_URL:-}" ]]; then
  OUTPUT_FILE="$BACKUP_DIR/selfmind_${TIMESTAMP}.dump"
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUTPUT_FILE"
else
  : "${POSTGRES_SERVER:=localhost}"
  : "${POSTGRES_PORT:=5432}"
  : "${POSTGRES_USER:=postgres}"
  : "${POSTGRES_DB:=selfmind_db}"
  OUTPUT_FILE="$BACKUP_DIR/selfmind_${POSTGRES_DB}_${TIMESTAMP}.dump"
  pg_dump \
    --host="$POSTGRES_SERVER" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$OUTPUT_FILE"
fi

printf 'Backup written to %s\n' "$OUTPUT_FILE"
printf 'Restore example: pg_restore --clean --if-exists --dbname "$DATABASE_URL" %s\n' "$OUTPUT_FILE"
