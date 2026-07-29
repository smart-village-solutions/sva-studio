FROM node:24.15.0-alpine

ARG SVA_IMAGE_REVISION

LABEL org.opencontainers.image.source="https://github.com/smart-village-solutions/sva-studio"
LABEL org.opencontainers.image.revision="${SVA_IMAGE_REVISION}"

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache aws-cli ca-certificates curl postgresql-client \
  && aws --version \
  && pg_dump --version \
  && pg_restore --version

COPY --chown=node:node deploy/backup-agent/agent.mjs /app/agent.mjs

USER node

ENTRYPOINT ["node", "/app/agent.mjs"]
