FROM node:25-alpine AS build

WORKDIR /workspace

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN npm install -g pnpm@9.12.2

COPY . .

# Remove stale incremental metadata from the host checkout.
# Otherwise tsc may skip emit although dist/ folders are absent in Docker context.
RUN find apps packages -name "*.tsbuildinfo" -type f -delete

RUN pnpm install --frozen-lockfile
# Build workspace libraries in dependency order (Nx graph: core → monitoring-client,sdk → auth,routing → plugin-example → app)
# --skip-nx-cache ensures builds are never skipped due to a stale cache
RUN pnpm nx run core:build --skip-nx-cache
RUN pnpm nx run monitoring-client:build --skip-nx-cache
RUN pnpm nx run sdk:build --skip-nx-cache
RUN pnpm nx run auth:build --skip-nx-cache
RUN pnpm nx run routing:build --skip-nx-cache
RUN pnpm nx run plugin-example:build --skip-nx-cache
RUN pnpm nx run sva-studio-react:build --skip-nx-cache
# Nitro-Build ist in den `vite build`-Lauf via nitro() Vite-Plugin integriert –
# ein separater `nitro build` würde das korrekte .output/server/ überschreiben.
RUN pnpm --filter sva-studio-react deploy --prod /workspace/.deploy/sva-studio-react

# Copy built dist/ artifacts of workspace packages into deployed pnpm package locations.
# Important: /node_modules/@sva/* are symlinks, so we target real .pnpm directories.
RUN find /workspace/.deploy/sva-studio-react/node_modules/.pnpm \
      -type d \
      -path '*/node_modules/@sva/*' | while read destdir; do \
      pkgname=$(basename "$destdir"); \
      src="/workspace/packages/${pkgname}/dist"; \
      if [ -d "$src" ]; then \
        echo "Copying dist for @sva/${pkgname} -> ${destdir}/dist"; \
        mkdir -p "${destdir}/dist"; \
        cp -r "$src/." "${destdir}/dist/"; \
      fi; \
    done

FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /workspace/.deploy/sva-studio-react/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/sva-studio-react/.output ./.output
COPY --from=build --chown=node:node /workspace/deploy/portainer/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
