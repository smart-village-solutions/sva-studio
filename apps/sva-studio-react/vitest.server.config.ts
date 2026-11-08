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
      ...(process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL
        ? ['src/lib/application-workspace.postgres.integration.test.ts']
        : []),
    ],
    exclude: prGateExcludedTestFiles.filter(
      (pattern) =>
        !process.env.APPLICATION_WORKSPACE_TEST_DATABASE_URL || !pattern.includes('postgres.integration')
    ),
  },
});
