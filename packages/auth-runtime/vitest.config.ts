import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@sva/core/security', replacement: resolve(currentDir, '../core/src/security/index.ts') },
      { find: /^@sva\/data-repositories\/server$/, replacement: resolve(currentDir, '../data-repositories/src/server.ts') },
      { find: /^@sva\/data-repositories$/, replacement: resolve(currentDir, '../data-repositories/src/index.ts') },
      { find: /^@sva\/media$/, replacement: resolve(currentDir, '../media/src/index.ts') },
      { find: /^@sva\/studio-module-iam$/, replacement: resolve(currentDir, '../studio-module-iam/src/index.ts') },
      { find: /^@sva\/server-runtime$/, replacement: resolve(currentDir, '../server-runtime/src/index.ts') },
      { find: /^@sva\/iam-core$/, replacement: resolve(currentDir, '../iam-core/src/index.ts') },
      { find: /^@sva\/iam-admin\/encryption$/, replacement: resolve(currentDir, '../iam-admin/src/encryption.ts') },
      { find: /^@sva\/iam-admin$/, replacement: resolve(currentDir, '../iam-admin/src/index.ts') },
      {
        find: /^@sva\/iam-governance\/read-models-internal$/,
        replacement: resolve(currentDir, '../iam-governance/src/read-models-internal.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-read-models-internal$/,
        replacement: resolve(currentDir, '../iam-governance/src/dsr-read-models-internal.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-flows$/,
        replacement: resolve(currentDir, '../iam-governance/src/dsr-export-flows.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-payload$/,
        replacement: resolve(currentDir, '../iam-governance/src/dsr-export-payload.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-export-status$/,
        replacement: resolve(currentDir, '../iam-governance/src/dsr-export-status.ts'),
      },
      {
        find: /^@sva\/iam-governance\/dsr-maintenance$/,
        replacement: resolve(currentDir, '../iam-governance/src/dsr-maintenance.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-repository-shared$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-repository-shared.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-repository$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-repository.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-mutation-handlers$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-mutation-handlers.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-http-handlers$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-http-handlers.ts'),
      },
      {
        find: /^@sva\/iam-governance\/legal-text-request-context$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-request-context.ts'),
      },
      {
        find: /^@sva\/iam-governance\/governance-compliance-export$/,
        replacement: resolve(currentDir, '../iam-governance/src/governance-compliance-export.ts'),
      },
      {
        find: /^@sva\/iam-governance\/governance-workflow-executor$/,
        replacement: resolve(currentDir, '../iam-governance/src/governance-workflow-executor.ts'),
      },
      {
        find: /^@sva\/iam-governance\/governance-workflow-policy$/,
        replacement: resolve(currentDir, '../iam-governance/src/governance-workflow-policy.ts'),
      },
      { find: /^@sva\/iam-governance$/, replacement: resolve(currentDir, '../iam-governance/src/index.ts') },
      { find: /^@sva\/core$/, replacement: resolve(currentDir, '../core/src/index.ts') },
      {
        find: /^@sva\/instance-registry\/http-contracts$/,
        replacement: resolve(currentDir, '../instance-registry/src/http-contracts.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-guards$/,
        replacement: resolve(currentDir, '../instance-registry/src/http-guards.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-instance-handlers$/,
        replacement: resolve(currentDir, '../instance-registry/src/http-instance-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-keycloak-handlers$/,
        replacement: resolve(currentDir, '../instance-registry/src/http-keycloak-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/http-mutation-handlers$/,
        replacement: resolve(currentDir, '../instance-registry/src/http-mutation-handlers.ts'),
      },
      {
        find: /^@sva\/instance-registry\/keycloak-types$/,
        replacement: resolve(currentDir, '../instance-registry/src/keycloak-types.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-auth$/,
        replacement: resolve(currentDir, '../instance-registry/src/provisioning-auth.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-auth-state$/,
        replacement: resolve(currentDir, '../instance-registry/src/provisioning-auth-state.ts'),
      },
      {
        find: /^@sva\/instance-registry\/provisioning-worker$/,
        replacement: resolve(currentDir, '../instance-registry/src/provisioning-worker.ts'),
      },
      {
        find: /^@sva\/instance-registry\/runtime-resolution$/,
        replacement: resolve(currentDir, '../instance-registry/src/runtime-resolution.ts'),
      },
      {
        find: /^@sva\/instance-registry\/runtime-wiring$/,
        replacement: resolve(currentDir, '../instance-registry/src/runtime-wiring.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service$/,
        replacement: resolve(currentDir, '../instance-registry/src/service.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-detail$/,
        replacement: resolve(currentDir, '../instance-registry/src/service-detail.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak$/,
        replacement: resolve(currentDir, '../instance-registry/src/service-keycloak.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak-execution$/,
        replacement: resolve(currentDir, '../instance-registry/src/service-keycloak-execution.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-keycloak-execution-shared$/,
        replacement: resolve(currentDir, '../instance-registry/src/service-keycloak-execution-shared.ts'),
      },
      {
        find: /^@sva\/instance-registry\/service-types$/,
        replacement: resolve(currentDir, '../instance-registry/src/service-types.ts'),
      },
      { find: /^@sva\/instance-registry$/, replacement: resolve(currentDir, '../instance-registry/src/index.ts') },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
