import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.config';

export default mergeConfig(
  sharedConfig,
  defineConfig({
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
