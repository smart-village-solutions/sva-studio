import { defineConfig } from 'vitest/config';

import { prGateExcludedTestFiles, sharedVitestConfig } from './vitest.shared.ts';

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    ...sharedVitestConfig.test,
    environment: 'node',
    setupFiles: [],
    include: [
      'src/**/*.server.test.{ts,tsx}',
      'src/**/*-server.test.{ts,tsx}',
      'src/server.test.{ts,tsx}',
    ],
    exclude: [...prGateExcludedTestFiles],
  },
});
