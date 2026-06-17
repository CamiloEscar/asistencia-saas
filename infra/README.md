# Infrastructure

> Local dev stack and deployment topology for `asistencia-saas`.

## Layout

```
infra/
├── docker/
│   ├── docker-compose.yml         # Local dev: Postgres 16 + Redis 7 + Adminer
│   ├── api.Dockerfile             # Multi-stage NestJS API image
│   ├── web.Dockerfile             # Multi-stage Vite/React SPA image
│   ├── nginx/
│   │   ├── web.conf               # nginx config for the web container (SPA + gzip)
│   │   └── conf.d/                # (reserved for production nginx)
│   └── postgres/
│       └── init/
│           └── 00-extensions.sql  # pgcrypto, citext, pg_trgm
├── scripts/                       # backup-db.sh, deploy.sh (added in Phase 19)
└── README.md                      # ← you are here
```

## Local dev quick-start

### Prerequisites

- **Node 20+** (see `.nvmrc`)
- **pnpm 8+** (or 9.x; `corepack enable` will provision it)
- **Docker** + **docker compose** plugin
- **PostgreSQL 16** and **Redis 7** clients (optional, for psql / redis-cli)

### Steps

```bash
# 1. Install workspace dependencies (from repo root)
pnpm install

# 2. Copy env files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Start Postgres + Redis + Adminer
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Wait for healthchecks, then verify
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml exec postgres pg_isready -U asistencia

# 5. Run Prisma migrations (creates schema, RLS policies, indexes)
pnpm --filter @asistencia/api prisma:migrate

# 6. Seed demo data (1 super admin + 2 institutions with users, courses, sessions)
pnpm --filter @asistencia/api prisma:seed

# 7. Start dev servers (api + web in parallel)
pnpm dev
```

The API is now at `http://localhost:3000/api/v1` and the SPA at `http://localhost:5173`.

### Default dev URLs (subdomain routing)

- `http://app.localhost:5173` → super-admin entry (no tenant)
- `http://universidad-a.app.localhost:5173` → institution A's login
- `http://universidad-b.app.localhost:5173` → institution B's login

Chrome and Firefox resolve `*.localhost` natively. Safari does not — see the [README troubleshooting](../../README.md#browser-support) section.

### Useful commands

| Command | What it does |
| --- | --- |
| `docker compose -f infra/docker/docker-compose.yml logs -f` | Tail logs from all dev services |
| `docker compose -f infra/docker/docker-compose.yml exec postgres psql -U asistencia -d asistencia_saas` | Open psql against the dev DB |
| `docker compose -f infra/docker/docker-compose.yml exec redis redis-cli` | Open redis-cli against the dev cache |
| `http://localhost:8080` | Adminer (DB UI; login: `postgres` / `asistencia` / `asistencia_saas`) |
| `pnpm --filter @asistencia/api exec prisma studio` | Open Prisma Studio (separate UI on port 5555) |

## Tear down

```bash
# Stop containers, keep volumes (data persists)
docker compose -f infra/docker/docker-compose.yml down

# Stop AND delete volumes (nukes local data — re-run migrations + seed)
docker compose -f infra/docker/docker-compose.yml down -v
```

## Environment variables

The `.env.example` files at the repo root and at each app (`apps/api/.env.example`, `apps/web/.env.example`) are the source of truth. Key vars:

### Root `.env`

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` — RS256 keypair (PEM, multiline; quoted). On first boot the API generates a fresh pair at `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` if these are empty.
- `CLOUDINARY_*` — institution logo upload credentials
- `ROOT_DOMAIN` — `localhost` in dev, `app.com` in prod (used to extract the tenant subdomain from the request host)

### `apps/api/.env`

- `COOKIE_SAMESITE` — `lax` per design #186 Q3 (must NOT be `strict` in prod because of cross-subdomain)
- `COOKIE_SECURE` — `true` in prod, `false` in dev (so cookies are sent over `http://*.app.localhost`)
- `THROTTLE_TTL` / `THROTTLE_LIMIT` — default per-user rate limit (overridable per endpoint with `@Throttle()`)
- `LOG_LEVEL` — pino level (`info` in dev/staging, `warn` in prod)

### `apps/web/.env`

- `VITE_API_URL` — base URL for the API. Empty in dev (uses Vite proxy at `/api`); set to `https://api.app.com` in prod builds.
- `VITE_DEFAULT_LOCALE` — `es` for MVP

## Production topology

The production stack runs on a Hostinger VPS behind Nginx (Phase 19). Summary:

```
Browser
  │  HTTPS
  ▼
Nginx (Hostinger VPS)   ← wildcard *.app.com cert, gzip, security headers
  │
  ├── /api/*  ──►  api:3000          (NestJS, containerized)
  ├── /api/*  ──►  worker (BullMQ)   (separate container, same image, different CMD)
  └── /*      ──►  web static         (nginx serving Vite build)

  │                │
  ▼                ▼
PgBouncer ──►  Postgres 16 (RLS active, two roles: app_user, app_admin)
Redis 7       (DB 0 cache/throttler, DB 1 refresh, DB 2 activation, DB 3 bullmq)
```

Full production setup, backup scripts, and deploy.sh land in Phase 19 (task 19.5+).
