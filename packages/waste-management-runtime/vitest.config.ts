import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sva/core': resolve(currentDir, '../core/src/index.ts'),
      '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
      '@sva/waste-management-contracts/job-definitions': resolve(
        currentDir,
        '../waste-management-contracts/src/job-definitions.ts'
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
