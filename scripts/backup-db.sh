#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/launch-game-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$file"
find "$BACKUP_DIR" -type f -name 'launch-game-*.dump' -mtime "+$RETENTION_DAYS" -delete
printf '%s\n' "$file"
