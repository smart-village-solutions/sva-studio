import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [
        'src/components/**/*.{test,spec}.{ts,tsx}',
        'src/providers/**/*.{test,spec}.{ts,tsx}',
        'src/i18n/**/*.{test,spec}.{ts,tsx}',
      ],
    },
  })
);
