import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.config';
import { fileURLToPath, URL } from 'node:url';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: [
        {
          find: '@sva/monitoring-client/logger-provider.server',
          replacement: fileURLToPath(new URL('../monitoring-client/src/logger-provider.server.ts', import.meta.url)),
        },
        {
          find: '@sva/monitoring-client/server',
          replacement: fileURLToPath(new URL('../monitoring-client/src/server.ts', import.meta.url)),
        },
        {
          find: '@sva/monitoring-client',
          replacement: fileURLToPath(new URL('../monitoring-client/src/index.ts', import.meta.url)),
        },
      ],
    },
    test: {
      name: 'sdk',
      environment: 'node',
      include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
