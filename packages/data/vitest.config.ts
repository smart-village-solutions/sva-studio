import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.vitest.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: {
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/data-client': resolve(__dirname, '../data-client/src/index.ts'),
      '@sva/data-repositories/server': resolve(__dirname, '../data-repositories/src/server.ts'),
      '@sva/data-repositories': resolve(__dirname, '../data-repositories/src/index.ts'),
    },
  },
});
