import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createPluginVitestConfig } from '../vitest-plugin-config.ts';

describe('createPluginVitestConfig', () => {
  it('creates source aliases for plugin workspaces and resolves extra aliases from the package root', () => {
    const config = createPluginVitestConfig({
      name: 'plugin-sdk-config-test',
      setupFiles: ['tests/setup.ts'],
      extraAliases: {
        '@sva/plugin-example/pages': '../plugin-events/src/events.pages.tsx',
      },
    });

    expect(config.resolve?.alias).toMatchObject({
      '@sva/core': expect.stringContaining('/packages/core/src/index.ts'),
      '@sva/plugin-sdk': expect.stringContaining('/packages/plugin-sdk/src/index.ts'),
      '@sva/studio-ui-react': expect.stringContaining('/packages/studio-ui-react/src/index.ts'),
      '@sva/plugin-example/pages': expect.stringContaining('/packages/plugin-events/src/events.pages.tsx'),
    });
    expect(config.test).toMatchObject({
      environment: 'jsdom',
      globals: true,
      name: 'plugin-sdk-config-test',
      setupFiles: ['tests/setup.ts'],
    });
  });

  it('uses defaults when optional inputs are omitted', () => {
    const config = createPluginVitestConfig({
      name: 'plugin-sdk-config-defaults',
    });

    expect(config.test?.setupFiles).toEqual([]);
    expect(fileURLToPath(new URL('../src/index.ts', import.meta.url))).toBe(config.resolve?.alias?.['@sva/plugin-sdk']);
  });
});
