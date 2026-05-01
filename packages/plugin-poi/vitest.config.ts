import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sva/core': resolve(currentDir, '../core/src/index.ts'),
      '@sva/media': resolve(currentDir, '../media/src/index.ts'),
      '@sva/plugin-sdk': resolve(currentDir, '../plugin-sdk/src/index.ts'),
      '@sva/studio-ui-react': resolve(currentDir, '../studio-ui-react/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    name: 'plugin-poi',
    setupFiles: [],
  },
});
