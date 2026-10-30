import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

if (
  !process.env.APP_TRANSLATIONS_TEST_DATABASE_URL &&
  !process.env.INSTANCE_PROVISIONING_INTEGRATION_DB &&
  !process.env.MAIL_TEMPLATES_TEST_ADMIN_URL
) {
  throw new Error('An explicit disposable PostgreSQL integration configuration is required');
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
