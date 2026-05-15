import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export const sharedCoverageConfig = {
  provider: 'v8',
  reporter: ['text-summary', 'json-summary', 'lcov'],
  reportsDirectory: './coverage',
} as const;

export default defineConfig({
  resolve: {
    alias: {
      '@sva/data': resolve(__dirname, './packages/data/src/index.ts'),
      '@sva/data/server': resolve(__dirname, './packages/data/src/server.ts'),
      '@sva/data-repositories': resolve(__dirname, './packages/data-repositories/src/index.ts'),
      '@sva/core': resolve(__dirname, './packages/core/src/index.ts'),
      '@sva/instance-registry/service': resolve(__dirname, './packages/instance-registry/src/service.ts'),
      '@sva/instance-registry/service-types': resolve(__dirname, './packages/instance-registry/src/service-types.ts'),
      '@sva/monitoring-client': resolve(__dirname, './packages/monitoring-client/src/index.ts'),
      '@sva/monitoring-client/logging': resolve(__dirname, './packages/monitoring-client/src/logging.ts'),
      '@sva/monitoring-client/logger-provider.server': resolve(
        __dirname,
        './packages/monitoring-client/src/logger-provider.server.ts'
      ),
      '@sva/monitoring-client/server': resolve(__dirname, './packages/monitoring-client/src/server.ts'),
      '@sva/server-runtime': resolve(__dirname, './packages/server-runtime/src/index.ts'),
    },
  },
  test: {
    coverage: sharedCoverageConfig,
  },
});
