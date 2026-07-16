#!/bin/sh
# Restore the newest Postgres dump from var/backups/postgres into the running db
# container. DESTRUCTIVE: replaces the current database. Run from the repo root.
set -e

if [ "$1" != "--yes" ]; then
    echo "Refusing: this OVERWRITES the current database."
    echo "Usage: make restore CONFIRM=yes"
    exit 1
fi

# Skip the owi-latest symlink: it lands as an unreadable 0-byte file on Windows bind mounts.
LATEST=$(ls -1t var/backups/postgres/last/*.sql.gz 2>/dev/null | grep -v latest | head -n 1)
if [ -z "$LATEST" ]; then
    echo "No dump found under var/backups/postgres/last/ — run 'make backup' first."
    exit 1
fi

echo "Restoring $LATEST"
docker compose --profile prod stop api worker scheduler

docker compose exec -T db sh -c \
    'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
gunzip -c "$LATEST" | docker compose exec -T db sh -c \
    'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

docker compose --profile prod start api worker scheduler
echo "Restore complete — run the smoke suite to verify."

# Images: mirror back with
#   docker compose exec minio-backup mc mirror --overwrite /backups/owi-images src/owi-images
