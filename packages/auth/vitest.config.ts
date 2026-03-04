import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts', 'src/**/*.e2e.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@sva/core/security': resolve(__dirname, '../core/src/security/index.ts'),
      '@sva/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
