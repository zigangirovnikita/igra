#!/usr/bin/env sh
set -eu

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: bash scripts/db-restore.sh backups/file.dump" >&2
  exit 1
fi

cat "$FILE" | docker compose exec -T db pg_restore \
  --username "${POSTGRES_USER:-launch_game}" \
  --dbname "${POSTGRES_DB:-launch_game}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

echo "Database restored from $FILE"
