import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sva\/core\/security$/, replacement: resolve(__dirname, '../core/src/security/index.ts') },
      { find: /^@sva\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: /^@sva\/monitoring-client\/logger-provider.server$/, replacement: resolve(__dirname, '../monitoring-client/src/logger-provider.server.ts') },
      { find: /^@sva\/monitoring-client\/server$/, replacement: resolve(__dirname, '../monitoring-client/src/server.ts') },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
