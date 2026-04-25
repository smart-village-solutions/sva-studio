import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sva\/core\/security$/, replacement: resolve(__dirname, '../core/src/security/index.ts') },
      { find: /^@sva\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: /^@sva\/server-runtime$/, replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
});
