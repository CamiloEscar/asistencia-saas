#!/usr/bin/env bash
#
# deploy.sh — Idempotent deployment script for asistencia-saas.
#
# Usage:  ./deploy.sh [--skip-backup] [--no-pull] [--branch BRANCH]
#
# This script is intended to be called from the GitHub Actions deploy
# workflow. It can also be run manually for one-off deploys.
#
# Steps:
#   1. Pull the latest code (if not --no-pull)
#   2. Pre-deploy backup (unless --skip-backup)
#   3. Build / pull images
#   4. Apply database migrations
#   5. Restart services with the new images
#   6. Health check loop
#   7. Report success or failure
#
# Requirements:
#   - docker + docker compose plugin
#   - infra/docker/.env (or env vars) with DB_PASSWORD, REDIS_PASSWORD
#   - JWT keys in infra/docker/secrets/
#   - Wildcard SSL cert at /etc/nginx/ssl/wildcard.pem
#
# Rollback: `git checkout HEAD~1 && ./deploy.sh --skip-backup`
#

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────
REPO_DIR="${REPO_DIR:-/opt/asistencia-saas}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-infra/docker/.env}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/asistencia-deploy.log}"

# ─── Argument parsing ──────────────────────────────────────────
SKIP_BACKUP=0
NO_PULL=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-backup) SKIP_BACKUP=1; shift ;;
        --no-pull) NO_PULL=1; shift ;;
        --branch) BRANCH="$2"; shift 2 ;;
        -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

# ─── Helpers ──────────────────────────────────────────────────
log()  { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE" ; }
fail() { log "ERROR: $*" >&2; exit 1; }
ok()   { log "OK: $*" ; }

# ─── Pre-flight checks ───────────────────────────────────────
cd "$REPO_DIR" || fail "Cannot cd to $REPO_DIR"
[[ -f "$COMPOSE_FILE" ]] || fail "Compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]]    || fail "Env file not found: $ENV_FILE"
[[ -f "$REPO_DIR/infra/docker/secrets/jwt-private.pem" ]] \
    || fail "JWT private key missing at infra/docker/secrets/jwt-private.pem"
[[ -f "$REPO_DIR/infra/docker/secrets/jwt-public.pem" ]] \
    || fail "JWT public key missing at infra/docker/secrets/jwt-public.pem"
[[ -f /etc/nginx/ssl/wildcard.pem ]] \
    || fail "Wildcard SSL cert missing at /etc/nginx/ssl/wildcard.pem"

command -v docker >/dev/null || fail "docker not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin not installed"

ok "Pre-flight checks passed"

# ─── 1. Pull latest code ──────────────────────────────────────
if [[ $NO_PULL -eq 0 ]]; then
    log "Pulling latest code from $BRANCH"
    git fetch origin "$BRANCH" || fail "git fetch failed"
    git checkout "$BRANCH"     || fail "git checkout failed"
    git pull origin "$BRANCH"  || fail "git pull failed"
    ok "Code updated to $(git rev-parse --short HEAD)"
else
    log "Skipping code pull (--no-pull)"
fi

# ─── 2. Pre-deploy backup ─────────────────────────────────────
if [[ $SKIP_BACKUP -eq 0 ]]; then
    if [[ -x "$REPO_DIR/infra/scripts/backup-db.sh" ]]; then
        log "Creating pre-deploy backup"
        "$REPO_DIR/infra/scripts/backup-db.sh" pre-deploy || \
            log "WARN: pre-deploy backup failed (non-fatal)"
    else
        log "WARN: backup-db.sh not found, skipping backup"
    fi
else
    log "Skipping backup (--skip-backup)"
fi

# ─── 3. Build / pull images ───────────────────────────────────
log "Building images"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build \
    || fail "docker compose build failed"
ok "Images built"

# ─── 4. Apply DB migrations ───────────────────────────────────
log "Applying database migrations"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm api \
    sh -c "cd /app && npx prisma migrate deploy" \
    || fail "prisma migrate deploy failed"
ok "Migrations applied"

# ─── 5. Restart services (rolling) ────────────────────────────
log "Restarting services"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d \
    || fail "docker compose up failed"
ok "Services up"

# ─── 6. Health check loop ─────────────────────────────────────
log "Waiting for /health to return 200 (max 60s)"
HEALTHY=0
for i in $(seq 1 30); do
    if curl -fsS -k "https://app.com/health" >/dev/null 2>&1; then
        HEALTHY=1
        break
    fi
    sleep 2
done

if [[ $HEALTHY -eq 0 ]]; then
    fail "Health check did not pass within 60s. Run: docker compose -f $COMPOSE_FILE logs --tail=200 api"
fi
ok "Health check passed"

# ─── 7. Done ──────────────────────────────────────────────────
log "Deployment complete"
log "Active containers:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --format 'table {{.Name}}\t{{.Status}}' \
    | tee -a "$LOG_FILE"

exit 0
