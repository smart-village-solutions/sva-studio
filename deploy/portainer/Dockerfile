FROM node:25-alpine AS build

WORKDIR /workspace

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN npm install -g pnpm@9.12.2

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm nx run sva-studio-react:build

FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /workspace/apps/sva-studio-react/dist ./
COPY --from=build --chown=node:node /workspace/deploy/portainer/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server/server.js"]
