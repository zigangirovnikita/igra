#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: restore-db.sh path/to/backup.dump}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" "$1"
