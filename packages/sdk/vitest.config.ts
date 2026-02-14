import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharedConfig from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        '@sva/monitoring-client/server': resolve(currentDir, '../monitoring-client/src/server.ts'),
        '@sva/monitoring-client/logger-provider.server': resolve(
          currentDir,
          '../monitoring-client/src/logger-provider.server.ts'
        ),
      },
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
