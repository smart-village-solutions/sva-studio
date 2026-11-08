import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import sharedConfig, { sharedCoverageConfig } from '../../vitest.config';
export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^@sva\/plugin-sdk$/,
          replacement: fileURLToPath(new URL('../plugin-sdk/src/index.ts', import.meta.url)),
        },
        {
          find: /^@sva\/studio-ui-react$/,
          replacement: fileURLToPath(new URL('../studio-ui-react/src/index.ts', import.meta.url)),
        },
        {
          find: /^@sva\/studio-module-iam$/,
          replacement: fileURLToPath(new URL('../studio-module-iam/src/index.ts', import.meta.url)),
        },
      ],
    },
    test: {
      coverage: { ...sharedCoverageConfig, include: ['src/**/*.{ts,tsx}'] },
      name: 'plugin-search',
      environment: 'happy-dom',
      include: ['tests/**/*.{test,spec}.{ts,tsx}'],
      fileParallelism: false,
      maxWorkers: 1,
    },
  })
);
