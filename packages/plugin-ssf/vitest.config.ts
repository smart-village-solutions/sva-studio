import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.config';

export default mergeConfig(
  sharedConfig,
  defineConfig({
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
