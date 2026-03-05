import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts', 'src/**/*.e2e.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: {
      '@sva/core/security': resolve(__dirname, '../core/src/security/index.ts'),
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/sdk/server': resolve(__dirname, '../sdk/src/server.ts'),
      '@sva/sdk': resolve(__dirname, '../sdk/src/index.ts'),
      '@sva/monitoring-client/server': resolve(__dirname, '../monitoring-client/src/server.ts'),
      '@sva/monitoring-client/logger-provider.server': resolve(
        __dirname,
        '../monitoring-client/src/logger-provider.server.ts'
      ),
    },
  },
});
