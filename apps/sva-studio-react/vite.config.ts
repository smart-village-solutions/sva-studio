import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { codecovRollupPlugin } from '@codecov/rollup-plugin';
import { nitro } from 'nitro/vite';
import { fileURLToPath, URL } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';

const normalizeDirectory = (url: URL) => fileURLToPath(url).replace(/[\\/]$/, '');

const appRoot = normalizeDirectory(new URL('./', import.meta.url));
const workspaceRoot = normalizeDirectory(new URL('../../', import.meta.url));
const tanstackRouterBasepath = '/';
const tanstackServerFnBase = '/_server';
const tanstackServerFnTransportBase = `${tanstackServerFnBase}/`;
const codecovEnabled = process.env.CODECOV_TOKEN !== undefined;
const tanstackDevtoolsEnabled =
  process.env.VITE_ENABLE_TANSTACK_DEVTOOLS === 'true' &&
  process.env.CI !== 'true' &&
  process.env.PLAYWRIGHT_TEST !== 'true';

const tanstackStartClientEnvCompatPlugin = () => ({
  name: 'tanstack-start-client-env-compat',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('@tanstack/start-client-core')) {
      return null;
    }

    if (!code.includes('process.env.TSS_SERVER_FN_BASE') && !code.includes('process.env.TSS_ROUTER_BASEPATH')) {
      return null;
    }

    return {
      code: code
        .replaceAll('process.env.TSS_SERVER_FN_BASE', JSON.stringify(tanstackServerFnTransportBase))
        .replaceAll('process.env.TSS_ROUTER_BASEPATH', JSON.stringify(tanstackRouterBasepath)),
      map: null,
    };
  },
});

// Nx starts the Vite process from the workspace root, but TanStack Start
// resolves framework dependencies from process.cwd() during dev-server setup.
// Align the process cwd with the app root so the virtual client/server entries
// can resolve React and @tanstack/react-start consistently.
if (process.cwd() !== appRoot) {
  process.chdir(appRoot);
}

const config = defineConfig({
  root: appRoot,
  server: {
    // Disable HMR in this TanStack Start SSR setup to avoid React preamble runtime crashes.
    hmr: false,
    fs: {
      // Nx restricts dev-server access to the app root. TanStack Start resolves
      // its virtual client/server entries into workspace-level pnpm store paths.
      allow: [workspaceRoot, appRoot],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // React 19 + Vite resolves react-dom/server -> server.browser (no default export).
      // TanStack router imports a default export here, so provide a compat shim.
      'react-dom/server': fileURLToPath(new URL('./src/lib/react-dom-server-compat.ts', import.meta.url)),
      // Workspace package subpath exports direkt auf Source files mappen (für Dev-SSR)
      '@sva/routing/server': fileURLToPath(new URL('../../packages/routing/src/index.server.ts', import.meta.url)),
      '@sva/routing/auth': fileURLToPath(new URL('../../packages/routing/src/auth.routes.ts', import.meta.url)),
      '@sva/routing': fileURLToPath(new URL('../../packages/routing/src/index.ts', import.meta.url)),
      '@sva/auth/server': fileURLToPath(new URL('../../packages/auth/src/index.server.ts', import.meta.url)),
      '@sva/auth': fileURLToPath(new URL('../../packages/auth/src/index.ts', import.meta.url)),
      '@sva/data/server': fileURLToPath(new URL('../../packages/data/src/server.ts', import.meta.url)),
      '@sva/data': fileURLToPath(new URL('../../packages/data/src/index.ts', import.meta.url)),
      '@sva/sva-mainserver/server': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.server.ts', import.meta.url)),
      '@sva/sva-mainserver': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.ts', import.meta.url)),
      '@sva/sdk/server': fileURLToPath(new URL('../../packages/sdk/src/server.ts', import.meta.url)),
      '@sva/sdk/logger/index.server': fileURLToPath(new URL('../../packages/sdk/src/logger/index.server.ts', import.meta.url)),
      '@sva/sdk/middleware/request-context.server': fileURLToPath(new URL('../../packages/sdk/src/middleware/request-context.server.ts', import.meta.url)),
      '@sva/sdk/observability/context.server': fileURLToPath(new URL('../../packages/sdk/src/observability/context.server.ts', import.meta.url)),
      '@sva/monitoring-client/server': fileURLToPath(new URL('../../packages/monitoring-client/src/server.ts', import.meta.url)),
      '@sva/monitoring-client/logger-provider.server': fileURLToPath(
        new URL('../../packages/monitoring-client/src/logger-provider.server.ts', import.meta.url)
      ),
      '@sva/monitoring-client': fileURLToPath(new URL('../../packages/monitoring-client/src/index.ts', import.meta.url)),
      '@sva/core/security': fileURLToPath(new URL('../../packages/core/src/security/index.ts', import.meta.url)),
      '@sva/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  ssr: {
    // Workspace packages müssen in Dev-SSR transpiliert werden, weil Vite package.json exports nicht korrekt auflöst
    noExternal: [
      '@sva/auth',
      '@sva/data',
      '@sva/routing',
      '@sva/sva-mainserver',
      '@sva/core',
      '@sva/sdk',
      '@sva/monitoring-client',
    ],
  },
  build: {
    rollupOptions: {
      // Node.js modules für Client-Build blocken
      external: [/^node:/, /^(async_hooks|crypto|fs|path|net|tls|events|stream|util|os|http|https|dns|url)$/, /^@sva\/.+\/server$/],
      plugins: codecovEnabled
        ? [
            codecovRollupPlugin({
              enableBundleAnalysis: true,
              bundleName: 'sva-studio-react',
              uploadToken: process.env.CODECOV_TOKEN,
            }),
          ]
        : [],
    },
  },
  plugins: [
    tsconfigPaths(),
    tanstackStartClientEnvCompatPlugin(),
    ...(tanstackDevtoolsEnabled ? [devtools()] : []),
    tanstackStart({
      serverFns: {
        base: tanstackServerFnBase,
      },
    }),
    nitro(),
    viteReact(),
  ],
});

export default config;
