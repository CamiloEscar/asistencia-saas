# asistencia-saas

> Multi-tenant SaaS platform for educational institutions (universities, institutes) to manage student attendance.

## Overview

A two-app monorepo (`pnpm` workspaces) with a NestJS API and a Vite + React SPA.
Each institution (tenant) gets isolated users, teachers, students, courses, subjects, and attendance records.
Tenant resolution happens via subdomain (e.g. `celsius.app.com` → institution `celsius`).

**Defense-in-depth multi-tenancy**: Prisma extension → PgBouncer SET LOCAL → PostgreSQL Row-Level Security. See `infra/README.md` and the SDD artifacts for details.

## Architecture

```
                  ┌────────────────────────────────────────────┐
                  │  Browser (Vite/React on Nginx)             │
                  │  *.app.com (prod) / *.app.localhost (dev)  │
                  └───────────────┬────────────────────────────┘
                                  │ HTTPS (cookies HttpOnly, SameSite=Lax)
                                  ▼
                  ┌────────────────────────────────────────────┐
                  │  Nginx (TLS termination, security headers) │
                  │  /api/*  → api:3000                         │
                  │  /*      → web static (web:80)              │
                  └────┬───────────────────────────┬──────────┘
                       │                           │
                       ▼                           ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │  NestJS API (Node 20)    │   │  Worker (Node 20)        │
        │  Clean Architecture      │   │  BullMQ consumers        │
        │  Prisma + Redis adapter  │   │  (bulk import jobs)      │
        │  Helmet, throttler, RLS  │   │  runWithContext tenant   │
        └─────┬───────────────┬────┘   └────────────┬─────────────┘
              │               │                     │
              ▼               ▼                     ▼
    ┌─────────────────┐  ┌─────────┐         ┌─────────────┐
    │ PostgreSQL 16   │  │ Redis 7 │         │  (same)     │
    │ + RLS policies  │  │ 7.2-alp │         │  Redis      │
    │ 16-shared       │  │ LRU 256m│         │  queue      │
    └─────────────────┘  └─────────┘         └─────────────┘
```

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, React Router v6, TanStack Query, Tailwind CSS, Shadcn/UI, React Hook Form + Zod, Zustand, react-i18next (ES only in MVP)
- **Backend**: NestJS 10, Node.js 20+, TypeScript, Prisma, PostgreSQL 16 with RLS
- **Auth**: JWT RS256 + refresh rotation with reuse detection (Lua atomic), Argon2id
- **Cache / Queue**: Redis 7 (refresh tokens, activation tokens, throttler, BullMQ)
- **Storage**: Cloudinary (institution logos)
- **Logging**: Pino (structured JSON, redacted) + `audit_log` table for security-relevant events
- **Validation**: Zod schemas shared FE↔BE (`packages/shared`)
- **Architecture**: Clean Architecture + DDD + SOLID (backend), feature-based (frontend)
- **Testing**: Jest (BE) + Vitest + Testing Library (FE) + Playwright (E2E)

## Repository Layout

```
apps/
  api/          # NestJS backend
  web/          # Vite + React SPA
packages/
  shared/       # Zod schemas, types, enums (shared FE↔BE)
  eslint-config/
  tsconfig/
infra/
  docker/       # docker-compose, Dockerfiles, nginx config
  scripts/      # deploy.sh, backup-db.sh
prisma/         # schema, migrations, seed
.github/        # CI/CD workflows (ci.yml, deploy.yml)
```

## Local Development

> Requires Node 20+ (see `.nvmrc`), pnpm 8+, Docker, and PostgreSQL/Redis clients.

### Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template
cp .env.example .env
# Edit .env if needed (defaults work for the bundled docker-compose)

# 3. Start PostgreSQL + Redis in Docker
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Run Prisma migrations + seed
pnpm --filter @asistencia/api exec prisma migrate deploy
pnpm --filter @asistencia/api exec prisma db seed

# 5. Start dev servers (api + web in parallel)
pnpm dev
```

The web app is on http://localhost:5173 and the API on http://localhost:3000.

For multi-tenant local dev, use the `*.app.localhost` domain pattern:

- Celsius: http://celsius.app.localhost:5173
- Universidad B: http://universidad-b.app.localhost:5173

> **Safari caveat**: `*.app.localhost` works in Chrome and Firefox. Safari requires `*.localhost` (TLD) or `/etc/hosts` entries. Use Chrome/Firefox for local dev.

### Test users (after seed)

| Role              | Email                       | Password      |
| ----------------- | --------------------------- | ------------- |
| Super Admin       | `super@asistencia-saas.com` | `super1234`   |
| Admin (Celsius)   | `admin@celsius.com`         | `admin1234`   |
| Admin (Univ. B)   | `admin@universidad-b.com`   | `admin1234`   |
| Teacher (Celsius) | `teacher1@celsius.com`      | `teacher1234` |
| Student (Celsius) | `student1@celsius.com`      | `student1234` |

## Testing

```bash
# Lint (ESLint v9 flat config)
pnpm -r lint

# Type check
pnpm -r typecheck

# Unit + integration tests
pnpm -r test

# E2E (Playwright) — see apps/web/e2e/README.md
pnpm --filter @asistencia/web test:e2e

# i18n key coverage check
pnpm --filter @asistencia/web check:i18n
```

## Deployment

Production deployment uses Docker Compose on a single VPS (Hostinger, DigitalOcean, Hetzner, etc.).

### One-time VPS setup

1. **Provision** a VPS with Docker + Docker Compose plugin installed.
2. **DNS**: wildcard `*.app.com` A record pointing to the VPS IP.
3. **SSL cert**: the user installs a wildcard cert via their Python bot. Mount it at `/etc/nginx/ssl/wildcard.pem` and `/etc/nginx/ssl/wildcard.key`. The nginx config consumes it read-only.
4. **Clone the repo** to `/opt/asistencia-saas`.
5. **Create secrets**:
   ```bash
   sudo mkdir -p /opt/asistencia-saas/infra/docker/secrets
   sudo cp /path/to/jwt-private.pem /opt/asistencia-saas/infra/docker/secrets/
   sudo cp /path/to/jwt-public.pem /opt/asistencia-saas/infra/docker/secrets/
   sudo chmod 600 /opt/asistencia-saas/infra/docker/secrets/*.pem
   ```
6. **Configure env**: copy `infra/docker/.env.example` to `infra/docker/.env` and fill in real values (DB password, Redis password, Cloudinary creds, cookie domain, CORS origins).

### Deploy

The recommended path is via the GitHub Actions `deploy.yml` workflow:

1. Add these GitHub repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY` (SSH private key with access to the VPS).
2. Push to `main` → CI runs → `deploy` job SSHs to the VPS and runs `infra/scripts/deploy.sh`.

Manual deploy:

```bash
ssh user@vps
cd /opt/asistencia-saas
git pull origin main
bash infra/scripts/deploy.sh
```

The deploy script is idempotent and safe to re-run. It backs up the DB, builds images, runs migrations, restarts services, and waits for `/health` to return 200.

### Backups

Daily at 03:00 UTC, run:

```bash
crontab -e
0 3 * * * /opt/asistencia-saas/infra/scripts/backup-db.sh >> /var/log/asistencia-backup.log 2>&1
```

Backups are written to `/backups/` with 30-day retention. To sync off-site, uncomment the `rsync` line in `backup-db.sh` and configure the destination.

### Monitoring

The `/health` endpoint is unauthenticated and returns 200 / 503 with dependency status. Recommended:

- UptimeRobot or BetterStack to ping `https://app.com/health` every 5 min
- Slack/Discord webhook from the deploy workflow on success/failure

### Rollback

```bash
ssh user@vps
cd /opt/asistencia-saas
git checkout HEAD~1
bash infra/scripts/deploy.sh
```

To restore a database backup, use `pg_restore` against the postgres container (see `infra/scripts/backup-db.sh` for the inverse operation).

## Troubleshooting

| Symptom                                  | Likely cause                                  | Fix                                                                |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Login fails with "institution not found" | Subdomain doesn't match an institution        | Check `institutions` table; check `X-Tenant-Subdomain` header      |
| `401` on every request                   | `JwtAuthGuard` ordering                       | Confirm `TenantMiddleware` runs before `JwtAuthGuard` in `main.ts` |
| Cross-tenant data leak                   | `tenantAwareExtension` not applied            | Check Prisma logs; verify `institutionId` is in WHERE clause       |
| `*app.localhost` not working in Safari   | Safari doesn't support `*.localhost` wildcard | Use Chrome/Firefox for dev, or set `/etc/hosts` entries            |
| Cookie not set on `app.com`              | Missing `Domain=.app.com`                     | Set `COOKIE_DOMAIN=.app.com` in env                                |
| Slow bulk import                         | Worker not running                            | Check `docker compose ps worker`; verify BullMQ connection         |
| Refresh fails with 401 in cluster        | Lua script not loaded on every node           | Verify `SCRIPT LOAD` runs on every Redis instance on boot          |

## Documentation

- **SDD artifacts**: Engram memory backend, topic keys `sdd/asistencia-saas/*` (proposal, 15 sub-specs, design, tasks, progress)
- **API reference**: OpenAPI spec at `/api/docs` (when enabled)
- **Runbook**: `infra/README.md`
- **E2E test docs**: `apps/web/e2e/README.md`

## License

Proprietary — all rights reserved.
