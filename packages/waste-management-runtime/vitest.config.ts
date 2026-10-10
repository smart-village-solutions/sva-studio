import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sva/core/security': resolve(currentDir, '../core/src/security/index.ts'),
      '@sva/core/rich-text-html': resolve(currentDir, '../core/src/rich-text-html.ts'),
      '@sva/core/rich-text-html-policy': resolve(currentDir, '../core/src/rich-text-html-policy.ts'),
      '@sva/core': resolve(currentDir, '../core/src/index.ts'),
      '@sva/monitoring-client/logging': resolve(currentDir, '../monitoring-client/src/logging.ts'),
      '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
      '@sva/server-runtime': resolve(currentDir, '../server-runtime/src/index.ts'),
      '@sva/waste-management-contracts/job-definitions': resolve(
        currentDir,
        '../waste-management-contracts/src/job-definitions.ts'
      ),
      '@sva/waste-management-contracts/unsubscribe-token': resolve(
        currentDir,
        '../waste-management-contracts/src/unsubscribe-token.server.ts'
      ),
      '@sva/waste-management-contracts': resolve(
        currentDir,
        '../waste-management-contracts/src/index.ts'
      ),
    },
  },
  test: {
    setupFiles: ['tests/test-utils/host-controls.setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.postgres.integration.test.ts'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
