import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharedConfig from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        '@sva/core': resolve(currentDir, '../core/src/index.ts'),
        '@sva/plugin-sdk/admin-resources': resolve(currentDir, '../plugin-sdk/src/admin-resources.ts'),
        '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
        '@sva/server-runtime/logger/index.server': resolve(currentDir, '../server-runtime/src/logger/index.server.ts'),
        '@sva/server-runtime/logger/logging-runtime.server': resolve(
          currentDir,
          '../server-runtime/src/logger/logging-runtime.server.ts'
        ),
        '@sva/server-runtime/logger/dev-log-buffer.server': resolve(
          currentDir,
          '../server-runtime/src/logger/dev-log-buffer.server.ts'
        ),
        '@sva/server-runtime/observability/context.server': resolve(
          currentDir,
          '../server-runtime/src/observability/context.server.ts'
        ),
        '@sva/server-runtime/middleware/request-context.server': resolve(
          currentDir,
          '../server-runtime/src/middleware/request-context.server.ts'
        ),
        '@sva/monitoring-client/server': resolve(currentDir, '../monitoring-client/src/server.ts'),
        '@sva/monitoring-client/logger-provider.server': resolve(
          currentDir,
          '../monitoring-client/src/logger-provider.server.ts'
        ),
        '@sva/monitoring-client/logging': resolve(currentDir, '../monitoring-client/src/logging.ts'),
        '@sva/monitoring-client': resolve(currentDir, '../monitoring-client/src/index.ts'),
      },
    },
    test: {
      name: 'sdk',
      environment: 'node',
      include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
