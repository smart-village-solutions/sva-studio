import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vitest/config';

import { sharedCoverageConfig } from '../../vitest.config.ts';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const createPluginVitestConfig = (input: Readonly<{
  name: string;
  setupFiles?: string[];
  extraAliases?: Record<string, string>;
}>): UserConfig =>
  defineConfig({
    resolve: {
      alias: {
        '@sva/core': resolve(currentDir, '../core/src/index.ts'),
        '@sva/plugin-sdk': resolve(currentDir, './src/index.ts'),
        '@sva/studio-ui-react': resolve(currentDir, '../studio-ui-react/src/index.ts'),
        ...Object.fromEntries(
          Object.entries(input.extraAliases ?? {}).map(([key, target]) => [key, resolve(currentDir, target)])
        ),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      name: input.name,
      setupFiles: input.setupFiles ?? [],
      coverage: sharedCoverageConfig,
    },
  });
