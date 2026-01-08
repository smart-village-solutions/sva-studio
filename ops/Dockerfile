# Minimal Dockerfile to exercise Operations review
FROM nginx:1.25-alpine

COPY ./ops/health.html /usr/share/nginx/html/health.html

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health.html || exit 1

