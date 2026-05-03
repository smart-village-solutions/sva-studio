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
      '@sva/auth-runtime/runtime-routes': resolveAppPath('../../packages/auth-runtime/src/runtime-routes.ts'),
      '@sva/auth-runtime/runtime-health': resolveAppPath('../../packages/auth-runtime/src/runtime-health.ts'),
      '@sva/auth-runtime': resolveAppPath('../../packages/auth-runtime/src/index.ts'),
      '@sva/data-repositories/server': resolveAppPath('../../packages/data-repositories/src/server.ts'),
      '@sva/data-repositories': resolveAppPath('../../packages/data-repositories/src/index.ts'),
      '@sva/iam-admin': resolveAppPath('../../packages/iam-admin/src/index.ts'),
      '@sva/iam-core': resolveAppPath('../../packages/iam-core/src/index.ts'),
      '@sva/iam-governance/read-models-internal': resolveAppPath(
        '../../packages/iam-governance/src/read-models-internal.ts'
      ),
      '@sva/iam-governance/dsr-read-models-internal': resolveAppPath(
        '../../packages/iam-governance/src/dsr-read-models-internal.ts'
      ),
      '@sva/iam-governance/dsr-export-flows': resolveAppPath(
        '../../packages/iam-governance/src/dsr-export-flows.ts'
      ),
      '@sva/iam-governance/dsr-export-payload': resolveAppPath(
        '../../packages/iam-governance/src/dsr-export-payload.ts'
      ),
      '@sva/iam-governance/dsr-export-status': resolveAppPath(
        '../../packages/iam-governance/src/dsr-export-status.ts'
      ),
      '@sva/iam-governance/dsr-maintenance': resolveAppPath('../../packages/iam-governance/src/dsr-maintenance.ts'),
      '@sva/iam-governance/legal-text-repository-shared': resolveAppPath(
        '../../packages/iam-governance/src/legal-text-repository-shared.ts'
      ),
      '@sva/iam-governance/legal-text-repository': resolveAppPath(
        '../../packages/iam-governance/src/legal-text-repository.ts'
      ),
      '@sva/iam-governance/legal-text-html': resolveAppPath('../../packages/iam-governance/src/legal-text-html.ts'),
      '@sva/iam-governance/legal-text-mutation-handlers': resolveAppPath(
        '../../packages/iam-governance/src/legal-text-mutation-handlers.ts'
      ),
      '@sva/iam-governance/legal-text-http-handlers': resolveAppPath(
        '../../packages/iam-governance/src/legal-text-http-handlers.ts'
      ),
      '@sva/iam-governance/legal-text-request-context': resolveAppPath(
        '../../packages/iam-governance/src/legal-text-request-context.ts'
      ),
      '@sva/iam-governance/governance-compliance-export': resolveAppPath(
        '../../packages/iam-governance/src/governance-compliance-export.ts'
      ),
      '@sva/iam-governance/governance-workflow-executor': resolveAppPath(
        '../../packages/iam-governance/src/governance-workflow-executor.ts'
      ),
      '@sva/iam-governance/governance-workflow-policy': resolveAppPath(
        '../../packages/iam-governance/src/governance-workflow-policy.ts'
      ),
      '@sva/iam-governance': resolveAppPath('../../packages/iam-governance/src/index.ts'),
      '@sva/instance-registry/http-contracts': resolveAppPath(
        '../../packages/instance-registry/src/http-contracts.ts'
      ),
      '@sva/instance-registry/http-guards': resolveAppPath('../../packages/instance-registry/src/http-guards.ts'),
      '@sva/instance-registry/http-instance-handlers': resolveAppPath(
        '../../packages/instance-registry/src/http-instance-handlers.ts'
      ),
      '@sva/instance-registry/http-keycloak-handlers': resolveAppPath(
        '../../packages/instance-registry/src/http-keycloak-handlers.ts'
      ),
      '@sva/instance-registry/http-mutation-handlers': resolveAppPath(
        '../../packages/instance-registry/src/http-mutation-handlers.ts'
      ),
      '@sva/instance-registry/keycloak-types': resolveAppPath(
        '../../packages/instance-registry/src/keycloak-types.ts'
      ),
      '@sva/instance-registry/provisioning-auth': resolveAppPath(
        '../../packages/instance-registry/src/provisioning-auth.ts'
      ),
      '@sva/instance-registry/provisioning-auth-state': resolveAppPath(
        '../../packages/instance-registry/src/provisioning-auth-state.ts'
      ),
      '@sva/instance-registry/provisioning-worker': resolveAppPath(
        '../../packages/instance-registry/src/provisioning-worker.ts'
      ),
      '@sva/instance-registry/runtime-resolution': resolveAppPath(
        '../../packages/instance-registry/src/runtime-resolution.ts'
      ),
      '@sva/instance-registry/runtime-wiring': resolveAppPath(
        '../../packages/instance-registry/src/runtime-wiring.ts'
      ),
      '@sva/instance-registry/service': resolveAppPath('../../packages/instance-registry/src/service.ts'),
      '@sva/instance-registry/service-detail': resolveAppPath(
        '../../packages/instance-registry/src/service-detail.ts'
      ),
      '@sva/instance-registry/service-keycloak': resolveAppPath(
        '../../packages/instance-registry/src/service-keycloak.ts'
      ),
      '@sva/instance-registry/service-keycloak-execution': resolveAppPath(
        '../../packages/instance-registry/src/service-keycloak-execution.ts'
      ),
      '@sva/instance-registry/service-keycloak-execution-shared': resolveAppPath(
        '../../packages/instance-registry/src/service-keycloak-execution-shared.ts'
      ),
      '@sva/instance-registry/service-types': resolveAppPath(
        '../../packages/instance-registry/src/service-types.ts'
      ),
      '@sva/instance-registry': resolveAppPath('../../packages/instance-registry/src/index.ts'),
      '@sva/sva-mainserver/server': resolveAppPath('../../packages/sva-mainserver/src/index.server.ts'),
      '@sva/sva-mainserver': resolveAppPath('../../packages/sva-mainserver/src/index.ts'),
      '@sva/media': resolveAppPath('../../packages/media/src/index.ts'),
      '@sva/plugin-sdk': resolveAppPath('../../packages/plugin-sdk/src/index.ts'),
      '@sva/studio-module-iam': resolveAppPath('../../packages/studio-module-iam/src/index.ts'),
      '@sva/studio-ui-react': resolveAppPath('../../packages/studio-ui-react/src/index.ts'),
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
      '@sva/data-repositories',
      '@sva/iam-admin',
      '@sva/iam-core',
      '@sva/iam-governance',
      '@sva/instance-registry',
      '@sva/media',
      '@sva/studio-module-iam',
      '@sva/routing',
      '@sva/studio-ui-react',
      '@sva/sva-mainserver',
      '@sva/core',
      '@sva/monitoring-client',
      '@sva/server-runtime',
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
