import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
      '@sva/plugin-waste-management/waste-management.job-definitions': resolve(
        currentDir,
        '../plugin-waste-management/src/waste-management.job-definitions.ts'
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
