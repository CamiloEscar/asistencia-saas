#!/usr/bin/env bash
#
# backup-db.sh — Idempotent daily database backup for asistencia-saas.
#
# Usage:
#   ./backup-db.sh [label]            # label is appended to filename (default: timestamp)
#   CRON=true ./backup-db.sh          # quiet mode for cron
#
# Backups are written to $BACKUP_DIR (default: /backups) and rotated
# after 30 days.
#
# Requirements: docker (we exec pg_dump inside the postgres container).
#
# Cron setup:
#   0 3 * * *  /opt/asistencia-saas/infra/scripts/backup-db.sh >> /var/log/asistencia-backup.log 2>&1
#
# Off-site sync (uncomment and configure):
#   rsync -avz --delete /backups/ backup-user@backup.example.com:/srv/asistencia-backups/
#

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
REPO_DIR="${REPO_DIR:-/opt/asistencia-saas}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-infra/docker/.env}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LABEL="${1:-$(date -u +'%Y%m%d_%H%M%S')}"
QUIET="${CRON:-false}"

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
DB_NAME="${DB_NAME:-asistencia}"
DB_USER="${DB_USER:-app_user}"

# ─── Helpers ──────────────────────────────────────────────────
log()  { $QUIET || echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# ─── Pre-flight ───────────────────────────────────────────────
cd "$REPO_DIR" || fail "Cannot cd to $REPO_DIR"
[[ -f "$COMPOSE_FILE" ]] || fail "Compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]]    || fail "Env file not found: $ENV_FILE"

mkdir -p "$BACKUP_DIR" || fail "Cannot create $BACKUP_DIR"

# Ensure postgres is healthy
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
        exec -T "$POSTGRES_SERVICE" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    fail "Postgres is not ready (pg_isready failed)"
fi

# ─── Backup ───────────────────────────────────────────────────
BACKUP_FILE="$BACKUP_DIR/asistencia-${LABEL}.sql.gz"
log "Creating backup: $BACKUP_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --format=custom --compress=9 --no-owner --no-privileges \
    | gzip > "$BACKUP_FILE"

# Verify the backup is not empty/corrupt
[[ -s "$BACKUP_FILE" ]] || fail "Backup file is empty: $BACKUP_FILE"
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup complete: $SIZE"

# ─── Retention ────────────────────────────────────────────────
log "Pruning backups older than $RETENTION_DAYS days"
PRUNED=$(find "$BACKUP_DIR" -name 'asistencia-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
log "Pruned $PRUNED old backup(s)"

# ─── Optional off-site sync ──────────────────────────────────
# Uncomment after configuring the remote backup destination.
# log "Syncing to off-site storage"
# rsync -avz --delete "$BACKUP_DIR/" backup-user@backup.example.com:/srv/asistencia-backups/ \
#     || log "WARN: off-site sync failed (non-fatal)"

log "Done"
exit 0
