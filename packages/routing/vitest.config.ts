import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: {
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/core/security': resolve(__dirname, '../core/src/security/index.ts'),
      '@sva/auth/server': resolve(__dirname, '../auth/src/index.ts'),
    },
  },
});
