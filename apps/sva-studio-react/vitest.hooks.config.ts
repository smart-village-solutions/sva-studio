import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [
        'src/hooks/**/*.{test,spec}.{ts,tsx}',
        'src/lib/**/*.{test,spec}.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.server.test.{ts,tsx}',
        'src/**/*-server.test.{ts,tsx}',
        'src/server.test.{ts,tsx}',
      ],
    },
  })
);
