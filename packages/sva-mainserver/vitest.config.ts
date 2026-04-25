import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10_000,
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: {
      '@sva/core/security': resolve(__dirname, '../core/src/security/index.ts'),
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/auth-runtime/server': resolve(__dirname, '../auth-runtime/src/server.ts'),
      '@sva/auth-runtime': resolve(__dirname, '../auth-runtime/src/index.ts'),
      '@sva/iam-admin': resolve(__dirname, '../iam-admin/src/index.ts'),
      '@sva/data-repositories/server': resolve(__dirname, '../data-repositories/src/server.ts'),
      '@sva/data-repositories': resolve(__dirname, '../data-repositories/src/index.ts'),
      '@sva/instance-registry/http-contracts': resolve(__dirname, '../instance-registry/src/http-contracts.ts'),
      '@sva/instance-registry': resolve(__dirname, '../instance-registry/src/index.ts'),
      '@sva/monitoring-client/logger-provider.server': resolve(
        __dirname,
        '../monitoring-client/src/logger-provider.server.ts',
      ),
      '@sva/monitoring-client/server': resolve(__dirname, '../monitoring-client/src/server.ts'),
      '@sva/monitoring-client/logging': resolve(__dirname, '../monitoring-client/src/logging.ts'),
      '@sva/monitoring-client': resolve(__dirname, '../monitoring-client/src/index.ts'),
      '@sva/routing/auth': resolve(__dirname, '../routing/src/auth.routes.ts'),
      '@sva/routing/server': resolve(__dirname, '../routing/src/index.server.ts'),
      '@sva/routing': resolve(__dirname, '../routing/src/index.ts'),
      '@sva/server-runtime': resolve(__dirname, '../server-runtime/src/index.ts'),
    },
  },
});
