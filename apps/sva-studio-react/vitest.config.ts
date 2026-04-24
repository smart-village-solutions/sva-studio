import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const appRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
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
      '@sva/auth-runtime': fileURLToPath(new URL('../../packages/auth-runtime/src/index.ts', import.meta.url)),
      '@sva/auth/runtime-routes': fileURLToPath(new URL('../../packages/auth/src/runtime-routes.server.ts', import.meta.url)),
      '@sva/auth/runtime-health': fileURLToPath(new URL('../../packages/auth/src/runtime-health.server.ts', import.meta.url)),
      '@sva/auth/server': fileURLToPath(new URL('../../packages/auth/src/index.server.ts', import.meta.url)),
      '@sva/auth': fileURLToPath(new URL('../../packages/auth/src/index.ts', import.meta.url)),
      '@sva/sva-mainserver/server': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.server.ts', import.meta.url)),
      '@sva/sva-mainserver': fileURLToPath(new URL('../../packages/sva-mainserver/src/index.ts', import.meta.url)),
      '@sva/plugin-sdk': fileURLToPath(new URL('../../packages/plugin-sdk/src/index.ts', import.meta.url)),
      '@sva/sdk/logging': fileURLToPath(new URL('../../packages/sdk/src/logging.ts', import.meta.url)),
      '@sva/sdk/logger/index.server': fileURLToPath(new URL('../../packages/sdk/src/logger/index.server.ts', import.meta.url)),
      '@sva/sdk/middleware/request-context.server': fileURLToPath(
        new URL('../../packages/sdk/src/middleware/request-context.server.ts', import.meta.url)
      ),
      '@sva/sdk/observability/context.server': fileURLToPath(
        new URL('../../packages/sdk/src/observability/context.server.ts', import.meta.url)
      ),
      '@sva/server-runtime': fileURLToPath(new URL('../../packages/server-runtime/src/index.ts', import.meta.url)),
      '@sva/sdk': fileURLToPath(new URL('../../packages/sdk/src/index.ts', import.meta.url)),
      '@sva/monitoring-client/server': fileURLToPath(new URL('../../packages/monitoring-client/src/server.ts', import.meta.url)),
      '@sva/monitoring-client/logger-provider.server': fileURLToPath(
        new URL('../../packages/monitoring-client/src/logger-provider.server.ts', import.meta.url)
      ),
      '@sva/monitoring-client': fileURLToPath(new URL('../../packages/monitoring-client/src/index.ts', import.meta.url)),
      '@sva/core/security': fileURLToPath(new URL('../../packages/core/src/security/index.ts', import.meta.url)),
      '@sva/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'sva-studio-react',
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
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
