import { defineConfig } from 'vitest/config';
import { sharedCoverageConfig } from '../../vitest.config.ts';
export default defineConfig({
  test: {
    coverage: { ...sharedCoverageConfig, include: ['src/**/*.{ts,tsx}'] },
    name: 'plugin-search',
    environment: 'happy-dom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
