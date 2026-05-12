import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [
        'src/routes/**/*.{test,spec}.{ts,tsx}',
        'src/routing/**/*.{test,spec}.{ts,tsx}',
      ],
    },
  })
);
