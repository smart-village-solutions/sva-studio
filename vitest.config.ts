import { defineConfig } from 'vitest/config';

export const sharedCoverageConfig = {
  provider: 'v8',
  reporter: ['text-summary', 'json-summary', 'lcov'],
  reportsDirectory: './coverage',
} as const;

export default defineConfig({
  test: {
    coverage: sharedCoverageConfig,
  },
});
