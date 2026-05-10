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

interface TsConfigJson {
  include?: string[];
}

interface NxProjectJson {
  targets?: Record<string, { options?: { lintFilePatterns?: string[] } }>;
}

function resolveRootDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

function loadRootPackageJson(): RootPackageJson {
  const rootDir = resolveRootDir();
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as RootPackageJson;
}

function loadCoveragePolicy(): CoveragePolicy {
  const rootDir = resolveRootDir();
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tooling/testing/coverage-policy.json'), 'utf8')
  ) as CoveragePolicy;
}

function loadStudioArtifactVerifyWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/studio-artifact-verify.yml'), 'utf8');
}

function loadScriptsTsConfig(): TsConfigJson {
  const rootDir = resolveRootDir();
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'tsconfig.scripts.json'), 'utf8')) as TsConfigJson;
}

function loadToolingTestingProject(): NxProjectJson {
  const rootDir = resolveRootDir();
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tooling/testing/project.json'), 'utf8')
  ) as NxProjectJson;
}

describe('workspace package scripts', () => {
  it('keeps patch coverage enforcement in the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const testPrScript = packageJson.scripts?.['test:pr'];

    expect(testPrScript).toContain('pnpm test:types');
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

  it('keeps studio image verify tag sanitizing portable on GitHub runners', () => {
    const workflow = loadStudioArtifactVerifyWorkflow();

    expect(workflow).toContain(
      "safe_tag=\"$(printf '%s' \"${IMAGE_TAG}\" | sed -E 's/[^[:alnum:]. _-]+/-/g; s/[[:space:]]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')\""
    );
    expect(workflow).not.toContain("tr -cs '[:alnum:]._- ' '-'");
  });

  it('runs type gates through workspace-wide Nx targets instead of hard-coded project lists', () => {
    const packageJson = loadRootPackageJson();
    const typesScript = packageJson.scripts?.['test:types'];

    expect(typesScript).toContain('nx run-many -t test:types --parallel=1');
    expect(typesScript).toContain('nx run-many -t typecheck --parallel=1');
    expect(typesScript).not.toContain('--projects=');
  });

  it('runs the server runtime guard through the shared Nx target', () => {
    const packageJson = loadRootPackageJson();
    const runtimeScript = packageJson.scripts?.['check:server-runtime'];

    expect(runtimeScript).toContain('nx run-many -t check:runtime --parallel=1');
    expect(runtimeScript).not.toContain('--projects=');
  });

  it('typechecks all CI gate sources via tsconfig.scripts.json', () => {
    const tsconfig = loadScriptsTsConfig();

    expect(tsconfig.include).toEqual(
      expect.arrayContaining([
        'scripts/ci/**/*.ts',
        'scripts/ops/**/*.ts',
      ])
    );
  });

  it('lints TypeScript script sources through the tooling-testing project', () => {
    const toolingTestingProject = loadToolingTestingProject();
    const lintPatterns = toolingTestingProject.targets?.lint?.options?.lintFilePatterns ?? [];

    expect(lintPatterns).toEqual(
      expect.arrayContaining([
        'tooling/testing/tests/**/*.{ts,tsx,js,jsx}',
        'scripts/**/*.ts',
      ])
    );
  });
});
