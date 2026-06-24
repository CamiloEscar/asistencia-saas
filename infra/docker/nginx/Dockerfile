# Multi-stage Dockerfile for nginx (production).
# Image: asistencia/nginx
#
# The final image is `nginx:alpine` with our custom config baked in.
# SSL certs are mounted at runtime (managed by the user's Python bot).
FROM nginx:alpine

# Install wget for healthcheck + envsubst for ${API_DOMAIN} interpolation
RUN apk add --no-cache wget gettext

# Copy main config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy server block (template — ${API_DOMAIN} is replaced at build time
# via docker-compose build args).
COPY conf.d/default.conf /etc/nginx/conf.d/default.conf.template

# Ensure log dir exists
RUN mkdir -p /var/log/nginx

# Render the template with build-time API_DOMAIN. Falls back to the
# literal string `${API_DOMAIN}` if not set, which nginx will serve
# as-is (operators can fix it by rebuilding with the arg).
ARG API_DOMAIN=__API_DOMAIN__
ENV API_DOMAIN=${API_DOMAIN}
RUN envsubst '${API_DOMAIN}' < /etc/nginx/conf.d/default.conf.template \
        > /etc/nginx/conf.d/default.conf \
    && rm /etc/nginx/conf.d/default.conf.template

EXPOSE 80 443

# Healthcheck (HTTPS)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider https://localhost/health || exit 1
