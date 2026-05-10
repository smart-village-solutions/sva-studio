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
        '@sva/core': resolve(currentDir, '../core/src/index.ts'),
        '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
        '@sva/studio-module-iam': resolve(currentDir, '../studio-module-iam/src/index.ts'),
        '@sva/studio-ui-react': resolve(currentDir, '../studio-ui-react/src/index.ts'),
      },
    },
    test: {
      name: 'plugin-waste-management',
      environment: 'happy-dom',
      include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
