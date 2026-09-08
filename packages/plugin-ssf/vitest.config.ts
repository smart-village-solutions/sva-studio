import { defineConfig, mergeConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharedConfig from '../../vitest.config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^@sva\/plugin-sdk$/,
          replacement: resolve(currentDir, '../plugin-sdk/src/index.ts'),
        },
      ],
    },
    test: {
      name: 'plugin-ssf',
      environment: 'node',
      include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
