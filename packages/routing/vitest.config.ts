import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: sharedCoverageConfig,
  },
  resolve: {
    alias: [
      { find: '@sva/core/security', replacement: resolve(__dirname, '../core/src/security/index.ts') },
      { find: '@sva/core', replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: '@sva/auth/runtime-routes', replacement: resolve(__dirname, '../auth/src/runtime-routes.server.ts') },
      { find: '@sva/auth/runtime-health', replacement: resolve(__dirname, '../auth/src/runtime-health.server.ts') },
      { find: '@sva/auth/server', replacement: resolve(__dirname, '../auth/src/index.server.ts') },
      { find: /^@sva\/auth$/, replacement: resolve(__dirname, '../auth/src/routes.shared.ts') },
      { find: '@sva/sdk/admin-resources', replacement: resolve(__dirname, '../sdk/src/admin-resources.ts') },
      { find: '@sva/sdk/server', replacement: resolve(__dirname, '../sdk/src/server.ts') },
    ],
  },
});
