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
      '@sva/core/security': resolve(__dirname, '../core/src/security/index.ts'),
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/auth/server': resolve(__dirname, '../auth/src/index.server.ts'),
      '@sva/auth': resolve(__dirname, '../auth/src/index.ts'),
      '@sva/data/server': resolve(__dirname, '../data/src/server.ts'),
      '@sva/data': resolve(__dirname, '../data/src/index.ts'),
      '@sva/sdk/server': resolve(__dirname, '../sdk/src/server.ts'),
    },
  },
});
