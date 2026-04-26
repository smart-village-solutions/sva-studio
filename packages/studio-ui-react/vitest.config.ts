import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from '../../vitest.config';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: 'studio-ui-react',
      environment: 'happy-dom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  })
);
