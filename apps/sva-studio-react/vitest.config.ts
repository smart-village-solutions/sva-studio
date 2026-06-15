import { defineConfig, mergeConfig } from 'vitest/config';

import { prGateExcludedTestFiles, sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'stagehand/**/*.{test,spec}.{ts,tsx}'],
      exclude: [...prGateExcludedTestFiles],
    },
  })
);
