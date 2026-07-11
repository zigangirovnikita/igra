#!/usr/bin/env sh
set -eu

mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="backups/launch_game_${STAMP}.dump"

docker compose exec -T db pg_dump \
  --username "${POSTGRES_USER:-launch_game}" \
  --dbname "${POSTGRES_DB:-launch_game}" \
  --format custom \
  --no-owner \
  --no-privileges > "$FILE"

echo "Backup written to $FILE"
