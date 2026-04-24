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
      { find: '@sva/auth-runtime/runtime-routes', replacement: resolve(__dirname, '../auth-runtime/src/runtime-routes.ts') },
      { find: '@sva/auth-runtime/runtime-health', replacement: resolve(__dirname, '../auth-runtime/src/runtime-health.ts') },
      { find: /^@sva\/auth-runtime$/, replacement: resolve(__dirname, '../auth-runtime/src/index.ts') },
      { find: '@sva/auth/runtime-routes', replacement: resolve(__dirname, '../auth/src/runtime-routes.server.ts') },
      { find: '@sva/auth/runtime-health', replacement: resolve(__dirname, '../auth/src/runtime-health.server.ts') },
      { find: /^@sva\/auth$/, replacement: resolve(__dirname, '../auth/src/routes.shared.ts') },
      { find: '@sva/plugin-sdk', replacement: resolve(__dirname, '../plugin-sdk/src/index.ts') },
      { find: '@sva/server-runtime', replacement: resolve(__dirname, '../server-runtime/src/index.ts') },
    ],
  },
});
