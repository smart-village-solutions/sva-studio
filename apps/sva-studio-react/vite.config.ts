import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { codecovRollupPlugin } from '@codecov/rollup-plugin';
import { nitro } from 'nitro/vite';
import { fileURLToPath, URL } from 'node:url';

const normalizeDirectory = (url: URL) => fileURLToPath(url).replace(/[\\/]$/, '');
const resolveAppPath = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

const appRoot = normalizeDirectory(new URL('./', import.meta.url));
const workspaceRoot = normalizeDirectory(new URL('../../', import.meta.url));
const tanstackRouterBasepath = '/';
const tanstackServerFnBase = '/_server';
const tanstackServerFnTransportBase = `${tanstackServerFnBase}/`;
const tanstackServerEntry = 'server.ts';
const codecovEnabled = process.env.CODECOV_TOKEN !== undefined;
const tanstackDevtoolsEnabled =
  process.env.VITE_ENABLE_TANSTACK_DEVTOOLS === 'true' &&
  process.env.CI !== 'true' &&
  process.env.PLAYWRIGHT_TEST !== 'true';
const configuredParentDomain = process.env.SVA_PARENT_DOMAIN?.trim().toLowerCase();
const configuredDevHost = process.env.HOST?.trim();
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  '.lvh.me',
  ...(configuredParentDomain ? [configuredParentDomain, `.${configuredParentDomain}`] : []),
];

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
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
      development: false,
      refresh: false,
    },
  },
  server: {
    host: configuredDevHost || '127.0.0.1',
    // Disable HMR in this TanStack Start SSR setup to avoid React preamble runtime crashes.
    hmr: false,
    allowedHosts,
    fs: {
      // Nx restricts dev-server access to the app root. TanStack Start resolves
      // its virtual client/server entries into workspace-level pnpm store paths.
      allow: [workspaceRoot, appRoot],
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': resolveAppPath('./src'),
      // React 19 + Vite resolves react-dom/server -> server.browser (no default export).
      // TanStack router imports a default export here, so provide a compat shim.
      'react-dom/server': resolveAppPath('./src/lib/react-dom-server-compat.ts'),
      // Force the ESM builds here. The CommonJS variants pull tslib through a broken SSR interop path.
      'react-remove-scroll': resolveAppPath('../../node_modules/.pnpm/node_modules/react-remove-scroll/dist/es2015'),
      'react-remove-scroll-bar': resolveAppPath('../../node_modules/.pnpm/node_modules/react-remove-scroll-bar/dist/es2015'),
      'react-style-singleton': resolveAppPath('../../node_modules/.pnpm/node_modules/react-style-singleton/dist/es2015'),
      tslib: resolveAppPath('../../node_modules/.pnpm/node_modules/tslib/tslib.es6.mjs'),
      'use-callback-ref': resolveAppPath('../../node_modules/.pnpm/node_modules/use-callback-ref/dist/es2015'),
      // Workspace package subpath exports direkt auf Source files mappen (für Dev-SSR)
      '@sva/routing/server': resolveAppPath('../../packages/routing/src/index.server.ts'),
      '@sva/routing/auth': resolveAppPath('../../packages/routing/src/auth.routes.ts'),
      '@sva/routing': resolveAppPath('../../packages/routing/src/index.ts'),
      '@sva/auth-runtime/server': resolveAppPath('../../packages/auth-runtime/src/server.ts'),
      '@sva/auth-runtime/routes': resolveAppPath('../../packages/auth-runtime/src/routes.ts'),
      '@sva/auth-runtime': resolveAppPath('../../packages/auth-runtime/src/index.ts'),
      '@sva/iam-admin': resolveAppPath('../../packages/iam-admin/src/index.ts'),
      '@sva/sva-mainserver/server': resolveAppPath('../../packages/sva-mainserver/src/index.server.ts'),
      '@sva/sva-mainserver': resolveAppPath('../../packages/sva-mainserver/src/index.ts'),
      '@sva/plugin-sdk': resolveAppPath('../../packages/plugin-sdk/src/index.ts'),
      '@sva/server-runtime': resolveAppPath('../../packages/server-runtime/src/index.ts'),
      '@sva/monitoring-client/server': resolveAppPath('../../packages/monitoring-client/src/server.ts'),
      '@sva/monitoring-client/logger-provider.server': resolveAppPath(
        '../../packages/monitoring-client/src/logger-provider.server.ts'
      ),
      '@sva/monitoring-client/logging': resolveAppPath('../../packages/monitoring-client/src/logging.ts'),
      '@sva/monitoring-client': resolveAppPath('../../packages/monitoring-client/src/index.ts'),
      '@sva/core/security': resolveAppPath('../../packages/core/src/security/index.ts'),
      '@sva/core': resolveAppPath('../../packages/core/src/index.ts'),
    },
  },
  ssr: {
    // Workspace packages müssen in Dev-SSR transpiliert werden, weil Vite package.json exports nicht korrekt auflöst
    noExternal: [
      '@sva/auth-runtime',
      '@sva/iam-admin',
      '@sva/routing',
      '@sva/sva-mainserver',
      '@sva/core',
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
    tanstackStartClientEnvCompatPlugin(),
    ...(tanstackDevtoolsEnabled ? [devtools()] : []),
    tanstackStart({
      server: {
        entry: tanstackServerEntry,
      },
      serverFns: {
        base: tanstackServerFnBase,
      },
    }),
    nitro(),
    viteReact(),
  ],
});

export default config;
