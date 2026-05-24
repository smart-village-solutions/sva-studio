import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDir, '../../..');
const expectedSetupEntry = 'tooling-testing/msw/setup';
const expectedSetupPath = "fileURLToPath(new URL(import.meta.resolve('tooling-testing/msw/setup')))";

const readText = (relativePath: string): string => {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
};

describe('MSW setup package contract', () => {
  it('exposes separate package exports for utilities and setup wiring', () => {
    const packageJson = JSON.parse(readText('tooling/testing/package.json')) as {
      exports?: Record<string, { default?: string; types?: string }>;
    };

    expect(packageJson.exports).toMatchObject({
      './msw': {
        default: './src/msw/index.ts',
      },
      './msw/setup': {
        default: './src/msw/setup.ts',
      },
    });
  });

  it('wires consumers to the dedicated setup package entry instead of source-relative paths', () => {
    const appVitestShared = readText('apps/sva-studio-react/vitest.shared.ts');
    const poiVitestConfig = readText('packages/plugin-poi/vitest.config.ts');
    const wasteVitestConfig = readText('packages/plugin-waste-management/vitest.config.ts');

    expect(appVitestShared).toContain(expectedSetupPath);
    expect(poiVitestConfig).toContain(expectedSetupPath);
    expect(wasteVitestConfig).toContain(expectedSetupPath);
    expect(appVitestShared).toContain('setupFiles: [studioMswSetupFile]');
    expect(poiVitestConfig).toContain('setupFiles: [studioMswSetupFile]');
    expect(wasteVitestConfig).toContain('setupFiles: [studioMswSetupFile]');

    expect(appVitestShared).not.toContain('../../tooling/testing/src/msw');
    expect(poiVitestConfig).not.toContain('../../tooling/testing/src/msw');
    expect(wasteVitestConfig).not.toContain('../../tooling/testing/src/msw');
    expect(appVitestShared).toContain(expectedSetupEntry);
    expect(poiVitestConfig).toContain(expectedSetupEntry);
    expect(wasteVitestConfig).toContain(expectedSetupEntry);
  });

  it('exports the browser worker as lazy factory instead of eager import-time instance', () => {
    const browserSource = readText('tooling/testing/src/msw/browser.ts');

    expect(browserSource).toContain('createStudioMswBrowser');
    expect(browserSource).not.toContain('export const studioMswBrowser =');
  });
});
