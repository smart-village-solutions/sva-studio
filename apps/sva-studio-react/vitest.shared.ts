import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const appRoot = fileURLToPath(new URL('.', import.meta.url));
export const studioMswSetupFile = fileURLToPath(new URL(import.meta.resolve('tooling-testing/msw/setup')));
export const prGateExcludedTestFiles = [
  'src/lib/development-logs.test.ts',
  'src/lib/plugins.test.ts',
] as const;

export const sharedVitestConfig = defineConfig({
  root: appRoot,
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-dom/server': fileURLToPath(new URL('./src/lib/react-dom-server-compat.ts', import.meta.url)),
      '@sva/routing/server': fileURLToPath(new URL('../../packages/routing/src/index.server.ts', import.meta.url)),
      '@sva/routing/auth': fileURLToPath(new URL('../../packages/routing/src/auth.routes.ts', import.meta.url)),
      '@sva/routing': fileURLToPath(new URL('../../packages/routing/src/index.ts', import.meta.url)),
      '@sva/auth-runtime/server': fileURLToPath(new URL('../../packages/auth-runtime/src/server.ts', import.meta.url)),
      '@sva/auth-runtime/routes': fileURLToPath(new URL('../../packages/auth-runtime/src/routes.ts', import.meta.url)),
      '@sva/auth-runtime/runtime-routes': fileURLToPath(
        new URL('../../packages/auth-runtime/src/runtime-routes.ts', import.meta.url)
      ),
      '@sva/auth-runtime/runtime-health': fileURLToPath(
        new URL('../../packages/auth-runtime/src/runtime-health.ts', import.meta.url)
      ),
      '@sva/auth-runtime': fileURLToPath(new URL('../../packages/auth-runtime/src/index.ts', import.meta.url)),
      '@sva/data-repositories/server': fileURLToPath(new URL('../../packages/data-repositories/src/server.ts', import.meta.url)),
      '@sva/data-repositories': fileURLToPath(new URL('../../packages/data-repositories/src/index.ts', import.meta.url)),
      '@sva/mail-runtime': fileURLToPath(new URL('../../packages/mail-runtime/src/index.ts', import.meta.url)),
      '@sva/iam-admin/encryption': fileURLToPath(new URL('../../packages/iam-admin/src/encryption.ts', import.meta.url)),
      '@sva/iam-admin': fileURLToPath(new URL('../../packages/iam-admin/src/index.ts', import.meta.url)),
      '@sva/iam-governance/legal-text-html': fileURLToPath(
        new URL('../../packages/iam-governance/src/legal-text-html.ts', import.meta.url)
      ),
      '@sva/iam-governance/legal-text-sanitize-html': fileURLToPath(
        new URL('../../packages/iam-governance/src/legal-text-sanitize-html.ts', import.meta.url)
      ),
      '@sva/iam-governance/dsr-export-payload': fileURLToPath(
        new URL('../../packages/iam-governance/src/dsr-export-payload.ts', import.meta.url)
      ),
      '@sva/sva-mainserver/server': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.server.ts', import.meta.url)),
      '@sva/sva-mainserver': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.ts', import.meta.url)),
      '@sva/instance-registry': fileURLToPath(new URL('../../packages/instance-registry/src/index.ts', import.meta.url)),
      '@sva/media': fileURLToPath(new URL('../../packages/media/src/index.ts', import.meta.url)),
      '@sva/plugin-events/events.pages': fileURLToPath(new URL('../../packages/plugin-events/src/events.pages.tsx', import.meta.url)),
      '@sva/plugin-poi/poi.pages': fileURLToPath(new URL('../../packages/plugin-poi/src/poi.pages.tsx', import.meta.url)),
      '@sva/plugin-waste-management/waste-management.job-definitions': fileURLToPath(
        new URL('../../packages/plugin-waste-management/src/waste-management.job-definitions.ts', import.meta.url)
      ),
      '@sva/plugin-waste-management': fileURLToPath(
        new URL('../../packages/plugin-waste-management/src/index.ts', import.meta.url)
      ),
      '@sva/plugin-sdk': fileURLToPath(new URL('../../packages/plugin-sdk/src/index.ts', import.meta.url)),
      '@sva/studio-module-iam': fileURLToPath(new URL('../../packages/studio-module-iam/src/index.ts', import.meta.url)),
      '@sva/studio-ui-react': fileURLToPath(new URL('../../packages/studio-ui-react/src/index.ts', import.meta.url)),
      '@sva/server-runtime': fileURLToPath(new URL('../../packages/server-runtime/src/index.ts', import.meta.url)),
      '@sva/monitoring-client/server': fileURLToPath(new URL('../../packages/monitoring-client/src/server.ts', import.meta.url)),
      '@sva/monitoring-client/logger-provider.server': fileURLToPath(
        new URL('../../packages/monitoring-client/src/logger-provider.server.ts', import.meta.url)
      ),
      '@sva/monitoring-client/logging': fileURLToPath(new URL('../../packages/monitoring-client/src/logging.ts', import.meta.url)),
      '@sva/monitoring-client': fileURLToPath(new URL('../../packages/monitoring-client/src/index.ts', import.meta.url)),
      '@sva/waste-management-runtime/server': fileURLToPath(
        new URL('../../packages/waste-management-runtime/src/server.ts', import.meta.url)
      ),
      '@sva/core/security': fileURLToPath(new URL('../../packages/core/src/security/index.ts', import.meta.url)),
      '@sva/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@sva/waste-management-runtime': fileURLToPath(
        new URL('../../packages/waste-management-runtime/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    name: 'sva-studio-react',
    environment: 'happy-dom',
    setupFiles: [studioMswSetupFile],
    // Serielle Ausführung reduziert Flakes in der UI-Testumgebung und stabilisiert affected-Läufe.
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
