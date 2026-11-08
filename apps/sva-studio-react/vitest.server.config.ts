import { defineConfig, mergeConfig } from 'vitest/config';

import { prGateExcludedTestFiles, sharedVitestConfig } from './vitest.shared.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [
        'src/**/*.server.test.{ts,tsx}',
        'src/**/*-server.test.{ts,tsx}',
        'src/server.test.{ts,tsx}',
        ...(process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL ? ['src/lib/application-workspace.postgres.integration.test.ts'] : []),
      ],
      exclude: prGateExcludedTestFiles.filter((pattern) => !process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL || !pattern.includes('postgres.integration')),
    },
  })
);
