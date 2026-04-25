import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@sva/auth/server', replacement: resolve(currentDir, '../auth/src/index.server.ts') },
      { find: '@sva/core/security', replacement: resolve(currentDir, '../core/src/security/index.ts') },
      { find: /^@sva\/data-repositories\/server$/, replacement: resolve(currentDir, '../data-repositories/src/server.ts') },
      { find: /^@sva\/data-repositories$/, replacement: resolve(currentDir, '../data-repositories/src/index.ts') },
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
        find: /^@sva\/iam-governance\/legal-text-repository-shared$/,
        replacement: resolve(currentDir, '../iam-governance/src/legal-text-repository-shared.ts'),
      },
      { find: /^@sva\/iam-governance$/, replacement: resolve(currentDir, '../iam-governance/src/index.ts') },
      { find: /^@sva\/auth$/, replacement: resolve(currentDir, '../auth/src/index.ts') },
      { find: /^@sva\/core$/, replacement: resolve(currentDir, '../core/src/index.ts') },
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
