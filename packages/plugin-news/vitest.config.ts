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
        '@sva/sdk': resolve(currentDir, '../sdk/src/index.ts'),
      },
    },
    test: {
      name: 'plugin-news',
      environment: 'happy-dom',
      include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
      // Der Thread-Pool mit happy-dom vermeidet Instabilitäten aus der jsdom/undici-Kombination.
      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
