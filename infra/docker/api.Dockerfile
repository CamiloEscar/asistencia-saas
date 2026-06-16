# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the NestJS API.
# Targets:
#   - api       (default, production server)
#   - builder   (intermediate, includes dev deps)
#   - deps      (intermediate, pnpm fetch + install offline)
#   - worker    (production worker that runs BullMQ consumers)
#
# Build examples:
#   docker build --target api -t asistencia/api:latest -f infra/docker/api.Dockerfile .
#   docker build --target worker -t asistencia/worker:latest -f infra/docker/api.Dockerfile .

ARG NODE_VERSION=20-alpine
ARG PNPM_VERSION=9.12.1

# ─────────────────────────────────────────────────────────────────────────────
# 1) DEPS — fetch + install pnpm dependencies with caching
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install pnpm via corepack (ships with Node 20).
RUN corepack enable && corepack prepare [email protected] --activate

# Copy lockfile + workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# pnpm fetch populates the offline store; --frozen-lockfile fails if lock is stale.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm fetch --frozen-lockfile

# Install from offline store.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# 2) BUILDER — build the API (and shared package) to dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy source for the workspaces we need to build.
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/tsconfig/ ./packages/tsconfig/
COPY apps/api/ ./apps/api/
COPY prisma/ ./prisma/

# Generate Prisma client (uses schema.prisma).
RUN pnpm --filter @asistencia/shared build || true
RUN pnpm --filter @asistencia/api exec prisma generate --schema=../../prisma/schema.prisma

# Build the API (NestJS).
RUN pnpm --filter @asistencia/api build

# ─────────────────────────────────────────────────────────────────────────────
# 3) PRODUCTION DEPS — slim deps for runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS prod-deps
WORKDIR /app

# Re-run install in production mode (prunes dev dependencies).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --prod --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# 4) API — production runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS api
WORKDIR /app

# Install dumb-init for proper PID 1 signal forwarding, and openssl for jwt keys.
RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production \
    PORT=3000

# Create non-root user.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built artifacts and prod deps.
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Secrets directory for JWT keypair (mounted as secret in compose).
RUN mkdir -p /app/secrets && chown -R nodejs:nodejs /app/secrets

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://localhost:3000/health || exit 1

# Migrations are run by the operator before starting the API (see deploy.sh /
# infra/README.md). Keeping them out of the container CMD prevents racing
# during rolling restarts and keeps the image small (prisma CLI is a dev dep).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]

# ─────────────────────────────────────────────────────────────────────────────
# 5) WORKER — BullMQ consumer process
# ─────────────────────────────────────────────────────────────────────────────
FROM api AS worker
WORKDIR /app

USER nodejs

CMD ["sh", "-c", "node apps/api/dist/worker.js"]
