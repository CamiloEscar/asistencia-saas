# asistencia-saas

> Multi-tenant SaaS platform for educational institutions (universities, institutes) to manage student attendance.

## Overview

A two-app monorepo (`pnpm` workspaces) with a NestJS API and a Vite + React SPA.
Each institution (tenant) gets isolated users, teachers, students, courses, subjects, and attendance records.
Tenant resolution happens via subdomain (e.g. `universidad-a.app.com` → institution `universidad-a`).

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, React Router v6, TanStack Query, Tailwind CSS, Shadcn/UI, React Hook Form + Zod, Zustand
- **Backend**: NestJS 10, Node.js 20+, TypeScript
- **Database**: PostgreSQL 16 with Prisma ORM
- **Auth**: JWT RS256 + refresh rotation, Argon2id
- **Cache**: Redis 7
- **Storage**: Cloudinary
- **Logging**: Pino (structured JSON) + `audit_log` table
- **Validation**: Zod schemas shared FE↔BE (`packages/shared`)
- **Architecture**: Clean Architecture + DDD + SOLID (backend), feature-based (frontend)

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
  docker/       # docker-compose, Dockerfiles, nginx
  scripts/      # backup-db.sh, deploy.sh
prisma/         # schema, migrations, seed
.github/        # CI/CD workflows
```

## Quick Start

> Requires Node 20+ (see `.nvmrc`), pnpm 8+, Docker, and PostgreSQL/Redis clients for local dev.

```bash
# 1. Install dependencies (after apps/api and apps/web package.json are populated)
pnpm install

# 2. Copy environment template
cp .env.example .env

# 3. Start PostgreSQL + Redis in Docker
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Run Prisma migrations + seed
pnpm --filter api prisma:migrate
pnpm --filter api prisma:seed

# 5. Start dev servers (api + web in parallel)
pnpm dev
```

## Scripts (root)

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps in dev mode in parallel |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check across the monorepo |
| `pnpm test` | Run all test suites |
| `pnpm format` | Format with Prettier |

## Documentation

- Spec-Driven Development artifacts: stored in Engram (memory backend) under topic keys `sdd/asistencia-saas/*`
- API design and module breakdown: see `apps/api/README.md` (coming soon)
- Frontend architecture: see `apps/web/README.md` (coming soon)

## License

Proprietary — all rights reserved.
