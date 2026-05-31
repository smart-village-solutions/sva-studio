import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['src/**/*.a11y.test.{ts,tsx}', 'src/**/*.a11y.spec.{ts,tsx}', 'src/test/a11y.test.ts'],
    },
  })
);
