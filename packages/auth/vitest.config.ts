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
      { find: /^@sva\/iam-admin$/, replacement: resolve(__dirname, '../iam-admin/src/index.ts') },
      {
        find: /^@sva\/iam-governance\/read-models-internal$/,
        replacement: resolve(__dirname, '../iam-governance/src/read-models-internal.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-read-models-internal$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-read-models-internal.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-repository-shared$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-repository-shared.ts'),
      },
      { find: /^@sva\/iam-governance$/, replacement: resolve(__dirname, '../iam-governance/src/index.ts') },
      {
        find: /^@sva\/instance-registry\/http-contracts$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-contracts.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak$/,
        replacement: resolve(__dirname, '../instance-registry/src/service-keycloak.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak-execution$/,
        replacement: resolve(__dirname, '../instance-registry/src/service-keycloak-execution.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak-execution-shared$/,
        replacement: resolve(__dirname, '../instance-registry/src/service-keycloak-execution-shared.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-types$/,
        replacement: resolve(__dirname, '../instance-registry/src/service-types.ts'),
      },
      { find: /^@sva\/instance-registry$/, replacement: resolve(__dirname, '../instance-registry/src/index.ts') },
      { find: /^@sva\/server-runtime$/, replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
      { find: /^@sva\/sdk$/, replacement: resolve(__dirname, '../sdk/src/index.ts') },
    ],
  },
});
