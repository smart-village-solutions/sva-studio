import { resolve } from 'node:path';

import { defineConfig, type ViteUserConfig } from 'vitest/config';

export const sharedCoverageConfig: NonNullable<NonNullable<ViteUserConfig['test']>['coverage']> = {
  provider: 'v8',
  reporter: ['text-summary', 'json-summary', 'lcov'],
  reportsDirectory: './coverage',
};

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@sva\/data\/server$/,
        replacement: resolve(__dirname, './packages/data/src/server.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-types$/,
        replacement: resolve(__dirname, './packages/instance-registry/src/service-types.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service$/,
        replacement: resolve(__dirname, './packages/instance-registry/src/service.ts'),
      },
      {
        find: /^@sva\/monitoring-client\/logger-provider\.server$/,
        replacement: resolve(__dirname, './packages/monitoring-client/src/logger-provider.server.ts'),
      },
      {
        find: /^@sva\/monitoring-client\/logging$/,
        replacement: resolve(__dirname, './packages/monitoring-client/src/logging.ts'),
      },
      {
        find: /^@sva\/monitoring-client\/server$/,
        replacement: resolve(__dirname, './packages/monitoring-client/src/server.ts'),
      },
      {
        find: /^@sva\/data-repositories\/server$/,
        replacement: resolve(__dirname, './packages/data-repositories/src/server.ts'),
      },
      {
        find: /^@sva\/data-repositories$/,
        replacement: resolve(__dirname, './packages/data-repositories/src/index.ts'),
      },
      {
        find: /^@sva\/server-runtime$/,
        replacement: resolve(__dirname, './packages/server-runtime/src/index.ts'),
      },
      {
        find: /^@sva\/monitoring-client$/,
        replacement: resolve(__dirname, './packages/monitoring-client/src/index.ts'),
      },
      {
        find: /^@sva\/data$/,
        replacement: resolve(__dirname, './packages/data/src/index.ts'),
      },
      {
        find: /^@sva\/core$/,
        replacement: resolve(__dirname, './packages/core/src/index.ts'),
      },
    ],
  },
  test: {
    coverage: sharedCoverageConfig,
    exclude: ['.worktrees/**'],
  },
});
