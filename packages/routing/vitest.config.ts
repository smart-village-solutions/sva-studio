import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: [
      { find: '@sva/core/security', replacement: resolve(__dirname, '../core/src/security/index.ts') },
      { find: '@sva/core', replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: '@sva/auth-runtime/routes', replacement: resolve(__dirname, '../auth-runtime/src/routes.ts') },
      { find: '@sva/auth-runtime/runtime-routes', replacement: resolve(__dirname, '../auth-runtime/src/runtime-routes.ts') },
      { find: '@sva/auth-runtime/runtime-health', replacement: resolve(__dirname, '../auth-runtime/src/runtime-health.ts') },
      { find: /^@sva\/data-repositories\/server$/, replacement: resolve(__dirname, '../data-repositories/src/server.ts') },
      { find: /^@sva\/data-repositories$/, replacement: resolve(__dirname, '../data-repositories/src/index.ts') },
      { find: /^@sva\/auth-runtime$/, replacement: resolve(__dirname, '../auth-runtime/src/index.ts') },
      { find: /^@sva\/iam-admin$/, replacement: resolve(__dirname, '../iam-admin/src/index.ts') },
      {
        find: /^@sva\/iam-governance\/governance-compliance-export$/,
        replacement: resolve(__dirname, '../iam-governance/src/governance-compliance-export.ts'),
      },
      {
        find: /^@sva\/iam-governance\/governance-workflow-executor$/,
        replacement: resolve(__dirname, '../iam-governance/src/governance-workflow-executor.ts'),
      },
      {
        find: /^@sva\/iam-governance\/governance-workflow-policy$/,
        replacement: resolve(__dirname, '../iam-governance/src/governance-workflow-policy.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-read-models-internal$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-read-models-internal.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-flows$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-export-flows.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-payload$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-export-payload.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-status$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-export-status.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-maintenance$/,
        replacement: resolve(__dirname, '../iam-governance/src/dsr-maintenance.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-repository-shared$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-repository-shared.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-repository$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-repository.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-mutation-handlers$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-mutation-handlers.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-http-handlers$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-http-handlers.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-request-context$/,
        replacement: resolve(__dirname, '../iam-governance/src/legal-text-request-context.ts'),
      },
      { find: /^@sva\/iam-governance$/, replacement: resolve(__dirname, '../iam-governance/src/index.ts') },
      { find: /^@sva\/instance-registry$/, replacement: resolve(__dirname, '../instance-registry/src/index.ts') },
      { find: '@sva/plugin-sdk', replacement: resolve(__dirname, '../plugin-sdk/src/index.ts') },
      { find: '@sva/server-runtime', replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
    ],
  },
});
