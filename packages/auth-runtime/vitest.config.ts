import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedCoverageConfig } from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sva/auth/runtime-routes': resolve(currentDir, '../auth/src/runtime-routes.server.ts'),
      '@sva/auth/runtime-health': resolve(currentDir, '../auth/src/runtime-health.server.ts'),
      '@sva/auth': resolve(currentDir, '../auth/src/index.ts'),
      '@sva/core': resolve(currentDir, '../core/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
