import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { sharedCoverageConfig } from '../../vitest.config';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['coverage/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      ...sharedCoverageConfig,
      reportsDirectory: resolve(projectRoot, 'coverage'),
    },
  },
});
