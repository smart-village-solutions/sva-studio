import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

const dataClientSourceGlob = resolve(__dirname, '../data-client/src/**');
const dataRepositoriesSourceGlob = resolve(__dirname, '../data-repositories/src/**');
const localTestGlobs = ['src/**/*.test.ts', 'src/**/*.vitest.test.ts'];

export default defineConfig({
  test: {
    include: localTestGlobs,
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      ...sharedCoverageConfig,
      include: ['src/**/*.ts'],
      exclude: [...localTestGlobs, dataClientSourceGlob, dataRepositoriesSourceGlob],
    },
  },
  resolve: {
    alias: {
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
      '@sva/data-client': resolve(__dirname, '../data-client/src/index.ts'),
      '@sva/data-repositories/server': resolve(__dirname, '../data-repositories/src/server.ts'),
      '@sva/data-repositories': resolve(__dirname, '../data-repositories/src/index.ts'),
      '@sva/monitoring-client/logging': resolve(__dirname, '../monitoring-client/src/logging.ts'),
      '@sva/server-runtime': resolve(__dirname, '../server-runtime/src/index.ts'),
    },
  },
});
