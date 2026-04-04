FROM node:25-alpine AS build

WORKDIR /workspace

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI=true
ENV NX_DAEMON=false
ENV NX_ADD_PLUGINS=false

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
RUN pnpm nx run data:build --skip-nx-cache
RUN pnpm nx run auth:build --skip-nx-cache
RUN pnpm nx run sva-mainserver:build --skip-nx-cache
RUN pnpm nx run routing:build --skip-nx-cache
RUN pnpm nx run plugin-example:build --skip-nx-cache
# Fix ESM relative imports/exports: add .js extensions to extensionless local paths.
# Some TypeScript emits extensionless ESM in dist/, which fails under Node ESM in runtime images.
RUN node -e "\
const fs = require('fs'); const path = require('path'); \
const distRoots = fs.readdirSync('packages', { withFileTypes: true }) \
  .filter((entry) => entry.isDirectory()) \
  .map((entry) => path.join('packages', entry.name, 'dist')) \
  .filter((dir) => fs.existsSync(dir)); \
const hasRuntimeExt = (p) => /\.(mjs|cjs|js|json)$/i.test(p); \
const needsPatch = (p) => p.startsWith('./') || p.startsWith('../'); \
const resolvePatchedSpecifier = (filePath, specifier) => { \
  if (!needsPatch(specifier) || hasRuntimeExt(specifier)) return specifier; \
  const baseDir = path.dirname(filePath); \
  const absPath = path.resolve(baseDir, specifier); \
  if (fs.existsSync(absPath + '.js')) return specifier + '.js'; \
  if (fs.existsSync(absPath + '.mjs')) return specifier + '.mjs'; \
  if (fs.existsSync(absPath)) { \
    try { \
      if (fs.statSync(absPath).isDirectory()) { \
        if (fs.existsSync(path.join(absPath, 'index.js'))) return specifier + '/index.js'; \
        if (fs.existsSync(path.join(absPath, 'index.mjs'))) return specifier + '/index.mjs'; \
      } \
    } catch {} \
  } \
  return specifier + '.js'; \
}; \
const patchFile = (filePath) => { \
  const source = fs.readFileSync(filePath, 'utf8'); \
  let patched = source.replace(/(from\\s+['\"])(\\.\\.?\\/[^'\"]+)(['\"])/g, (m, a, b, c) => a + resolvePatchedSpecifier(filePath, b) + c); \
  patched = patched.replace(/(import\\s+['\"])(\\.\\.?\\/[^'\"]+)(['\"])/g, (m, a, b, c) => a + resolvePatchedSpecifier(filePath, b) + c); \
  if (patched !== source) { \
    fs.writeFileSync(filePath, patched, 'utf8'); \
    console.log('patched', filePath); \
  } \
}; \
const walk = (dir) => { \
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { \
    const fullPath = path.join(dir, entry.name); \
    if (entry.isDirectory()) walk(fullPath); \
    else if (entry.isFile() && fullPath.endsWith('.js')) patchFile(fullPath); \
  } \
}; \
for (const distRoot of distRoots) walk(distRoot);"
# The app build must invoke Vite directly. The Nx Vite executor currently only
# emits the client bundle for this TanStack Start app, while `vite build`
# produces client, SSR service bundle and Nitro server output in one pass.
RUN pnpm nx run sva-studio-react:build --skip-nx-cache
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
COPY --from=build --chown=node:node /workspace/deploy/portainer/otel-bootstrap.mjs ./otel-bootstrap.mjs
RUN chmod +x entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "--import", "./otel-bootstrap.mjs", ".output/server/index.mjs"]
