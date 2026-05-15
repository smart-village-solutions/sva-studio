import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: sharedCoverageConfig,
  },
});
