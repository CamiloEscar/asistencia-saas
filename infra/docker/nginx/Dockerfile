# Multi-stage Dockerfile for nginx (production).
# Image: asistencia/nginx
#
# The final image is `nginx:alpine` with our custom config baked in.
# SSL certs are mounted at runtime (managed by the user's Python bot).
FROM nginx:alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy main config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy server block
COPY conf.d/default.conf /etc/nginx/conf.d/default.conf

# Ensure log dir exists
RUN mkdir -p /var/log/nginx

EXPOSE 80 443

# Healthcheck (HTTPS)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider https://localhost/health || exit 1
