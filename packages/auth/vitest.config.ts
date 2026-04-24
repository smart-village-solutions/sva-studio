import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

const testEnv =
  process.env.REDIS_URL || process.env.CI
    ? {}
    : {
        // Local Docker exposes Redis on localhost; without this, auth tests fall back to redis://redis:6379.
        REDIS_URL: 'redis://localhost:6379',
      };

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts', 'src/**/*.e2e.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    coverage: sharedCoverageConfig,
    env: testEnv,
  },
  resolve: {
    alias: [
      { find: '@sva/core/security', replacement: resolve(__dirname, '../core/src/security/index.ts') },
      { find: '@sva/data-repositories/server', replacement: resolve(__dirname, '../data-repositories/src/server.ts') },
      {
        find: '@sva/monitoring-client/logger-provider.server',
        replacement: resolve(__dirname, '../monitoring-client/src/logger-provider.server.ts'),
      },
      { find: '@sva/monitoring-client/server', replacement: resolve(__dirname, '../monitoring-client/src/server.ts') },
      { find: /^@sva\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: /^@sva\/data-repositories$/, replacement: resolve(__dirname, '../data-repositories/src/index.ts') },
      { find: /^@sva\/instance-registry$/, replacement: resolve(__dirname, '../instance-registry/src/index.ts') },
      { find: /^@sva\/server-runtime$/, replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
      { find: /^@sva\/sdk$/, replacement: resolve(__dirname, '../sdk/src/index.ts') },
    ],
  },
});
