# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the Vite/React web SPA.
# Stage 1: build static assets with Vite.
# Stage 2: serve them via nginx:alpine with SPA fallback.
#
# Build:
#   docker build \
#     --build-arg VITE_API_URL=https://api.app.com \
#     -t asistencia/web:latest \
#     -f infra/docker/web.Dockerfile .
#
# Run:
#   docker run --rm -p 8080:80 asistencia/web:latest

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

# ─────────────────────────────────────────────────────────────────────────────
# 1) BUILDER — install deps and build the Vite SPA
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# pnpm via corepack.
RUN corepack enable && corepack prepare [email protected] --activate

# Workspace manifests for caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (dev + prod) for the build.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm fetch --frozen-lockfile

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile

# Copy source for the web app + shared package.
COPY packages/shared/ ./packages/shared/
COPY packages/tsconfig/ ./packages/tsconfig/
COPY apps/web/ ./apps/web/

# Build the SPA.
RUN pnpm --filter @asistencia/shared build
RUN pnpm --filter @asistencia/web build

# ─────────────────────────────────────────────────────────────────────────────
# 2) RUNTIME — nginx serving the SPA
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:${NGINX_VERSION} AS runtime

# nginx config: SPA fallback to index.html, gzip, no-cache for index.html.
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/nginx/web.conf /etc/nginx/conf.d/default.conf

# Healthcheck on the nginx default endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
