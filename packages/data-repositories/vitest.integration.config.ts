import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

if (!process.env.APP_TRANSLATIONS_TEST_DATABASE_URL) {
  throw new Error(
    'APP_TRANSLATIONS_TEST_DATABASE_URL is required for PostgreSQL integration tests'
  );
}
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.postgres.integration.test.ts'],
    exclude: ['dist/**', 'coverage/**', 'node_modules/**'],
    fileParallelism: false,
  },
});
