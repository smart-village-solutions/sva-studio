import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface RootPackageJson {
  scripts?: Record<string, string>;
}

interface CoveragePolicy {
  globalFloors: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
}

function loadRootPackageJson(): RootPackageJson {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as RootPackageJson;
}

function loadCoveragePolicy(): CoveragePolicy {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tooling/testing/coverage-policy.json'), 'utf8')
  ) as CoveragePolicy;
}

describe('workspace package scripts', () => {
  it('keeps patch coverage enforcement in the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const testPrScript = packageJson.scripts?.['test:pr'];

    expect(testPrScript).toContain('pnpm patch-coverage-gate --base=origin/main');
    expect(testPrScript).toContain('pnpm sonar-new-code-gate --base=origin/main');
  });

  it('keeps studio release verification outside the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const releaseScript = packageJson.scripts?.['test:release:studio'];

    expect(packageJson.scripts?.['test:pr']).not.toContain('pnpm verify:runtime-artifact');
    expect(releaseScript).toBe('pnpm test:pr && pnpm verify:runtime-artifact');
  });

  it('keeps plugin UI boundary enforcement in PR and CI gates', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['check:plugin-ui-boundary']).toBe('tsx scripts/ci/check-plugin-ui-boundary.ts');
    expect(packageJson.scripts?.['test:eslint']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:pr']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:ci']).toContain('pnpm check:plugin-ui-boundary');
  });

  it('keeps the dedicated PR coverage command aligned with the patch gate', () => {
    const packageJson = loadRootPackageJson();
    const testCoveragePrScript = packageJson.scripts?.['test:coverage:pr'];

    expect(testCoveragePrScript).toContain('pnpm patch-coverage-gate --base=origin/main');
    expect(testCoveragePrScript).toContain('pnpm sonar-new-code-gate --base=origin/main');
  });

  it('exposes the Sonar LCOV preparation command', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['sonar:prepare-lcov']).toBe('tsx scripts/ci/prepare-sonar-lcov.ts');
  });

  it('keeps global coverage floors at the project baseline', () => {
    const policy = loadCoveragePolicy();

    expect(policy.globalFloors).toEqual({
      lines: 85,
      statements: 85,
      functions: 85,
      branches: 85,
    });
  });

  it('exposes a dedicated local studio release command', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['env:release:studio:local']).toBe('tsx scripts/ops/studio-release-local.ts');
  });
});
