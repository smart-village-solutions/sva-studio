import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.postgres.integration.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    fileParallelism: false,
  },
});
