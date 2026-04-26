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
      { find: /^@sva\/iam-core$/, replacement: resolve(__dirname, '../iam-core/src/index.ts') },
      { find: /^@sva\/iam-admin$/, replacement: resolve(__dirname, '../iam-admin/src/index.ts') },
      {
        find: /^@sva\/monitoring-client\/logger-provider.server$/,
        replacement: resolve(__dirname, '../monitoring-client/src/logger-provider.server.ts'),
      },
      { find: /^@sva\/monitoring-client\/server$/, replacement: resolve(__dirname, '../monitoring-client/src/server.ts') },
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
      {
        find: /^@sva\/instance-registry\/http-contracts$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-contracts.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-guards$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-guards.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-instance-handlers$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-instance-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-keycloak-handlers$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-keycloak-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-mutation-handlers$/,
        replacement: resolve(__dirname, '../instance-registry/src/http-mutation-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/keycloak-types$/,
        replacement: resolve(__dirname, '../instance-registry/src/keycloak-types.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-auth$/,
        replacement: resolve(__dirname, '../instance-registry/src/provisioning-auth.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-auth-state$/,
        replacement: resolve(__dirname, '../instance-registry/src/provisioning-auth-state.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-worker$/,
        replacement: resolve(__dirname, '../instance-registry/src/provisioning-worker.ts'),
      },
      {
        find: /^@sva\/instance-registry\/runtime-resolution$/,
        replacement: resolve(__dirname, '../instance-registry/src/runtime-resolution.ts'),
      },
      {
        find: /^@sva\/instance-registry\/runtime-wiring$/,
        replacement: resolve(__dirname, '../instance-registry/src/runtime-wiring.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service$/,
        replacement: resolve(__dirname, '../instance-registry/src/service.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-detail$/,
        replacement: resolve(__dirname, '../instance-registry/src/service-detail.ts'),
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
      { find: '@sva/plugin-sdk', replacement: resolve(__dirname, '../plugin-sdk/src/index.ts') },
      { find: '@sva/server-runtime', replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
    ],
  },
});
