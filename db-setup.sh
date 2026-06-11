#!/bin/sh
HOST="${1:-localhost}"
PORT="${2:-5432}"
ADMIN_USER="${3:-postgres}"
export PGPASSWORD="${4:-}"

psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -f db-setup.sql
echo "Done. Set DATABASE_URL=postgresql://wakatime:wakatime@$HOST:$PORT/wakatime-bot?schema=public"
