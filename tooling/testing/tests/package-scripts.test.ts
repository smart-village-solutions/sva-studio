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

type NamedInputValue = string | { env: string };

interface NxProjectJson {
  targets?: Record<string, { options?: { command?: string; lintFilePatterns?: string[] } }>;
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

function loadStudioImageVerifyWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/studio-image-verify.yml'), 'utf8');
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

function loadProjectJson(projectPath: string): NxProjectJson {
  const rootDir = resolveRootDir();
  return JSON.parse(fs.readFileSync(path.join(rootDir, projectPath, 'project.json'), 'utf8')) as NxProjectJson;
}

function loadQualityGatesWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/quality-gates.yml'), 'utf8');
}

function loadRuntimeGatesWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/runtime-gates.yml'), 'utf8');
}

function loadAppE2EWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/app-e2e.yml'), 'utf8');
}

function loadMainBuildWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/main-build.yml'), 'utf8');
}

function loadRepositoryHygieneWorkflow(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.github/workflows/repository-hygiene.yml'), 'utf8');
}

function loadRunPrGateScript(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, 'scripts/ci/run-pr-gate.ts'), 'utf8');
}

function loadAffectedUnitGateScript(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, 'scripts/ci/affected-unit-gate.ts'), 'utf8');
}

function loadScript(relativePath: string): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function loadNxJson(): { namedInputs?: Record<string, NamedInputValue[]> } {
  const rootDir = resolveRootDir();
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'nx.json'), 'utf8')) as {
    namedInputs?: Record<string, NamedInputValue[]>;
  };
}

describe('workspace package scripts', () => {
  it('keeps patch coverage enforcement in the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const testPrScript = packageJson.scripts?.['test:pr'];
    const runPrGateScript = loadRunPrGateScript();

    expect(testPrScript).toBe('tsx scripts/ci/run-pr-gate.ts');
    expect(runPrGateScript).toContain('pnpm patch-coverage-gate --base=${base}');
    expect(runPrGateScript).toContain('pnpm sonar-new-code-gate --base=${base}');
  });

  it('keeps studio release verification outside the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const releaseScript = packageJson.scripts?.['test:release:studio'];

    expect(packageJson.scripts?.['test:pr']).not.toContain('pnpm verify:runtime-artifact');
    expect(releaseScript).toBe('pnpm test:pr && pnpm verify:runtime-artifact');
  });

  it('keeps plugin boundary enforcement in PR and CI gates', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['check:plugin-ui-boundary']).toBe('tsx scripts/ci/check-plugin-ui-boundary.ts');
    expect(packageJson.scripts?.['check:plugin-architecture-boundary']).toBe(
      'tsx scripts/ci/check-plugin-architecture-boundary.ts'
    );
    expect(packageJson.scripts?.['test:eslint']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:eslint']).toContain('pnpm check:plugin-architecture-boundary');
    expect(packageJson.scripts?.['test:ci']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:ci']).toContain('pnpm check:plugin-architecture-boundary');
  });

  it('keeps the dedicated PR coverage command aligned with the patch gate', () => {
    const packageJson = loadRootPackageJson();
    const testCoveragePrScript = packageJson.scripts?.['test:coverage:pr'];

    expect(testCoveragePrScript).toContain('pnpm patch-coverage-gate --base=${NX_BASE:-origin/main}');
    expect(testCoveragePrScript).toContain('pnpm sonar-new-code-gate --base=${NX_BASE:-origin/main}');
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
    const workflow = loadStudioImageVerifyWorkflow();

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

  it('cleans instance-registry declaration artifacts before building public package exports', () => {
    const project = loadProjectJson('packages/instance-registry');
    const buildCommand = project.targets?.build?.options?.command;

    expect(buildCommand).toBeDefined();
    expect(typeof buildCommand).toBe('string');
    expect(buildCommand).toContain("rmSync('packages/instance-registry/dist'");
    expect(buildCommand).toContain("rmSync('packages/instance-registry/tsconfig.lib.tsbuildinfo'");
    expect(buildCommand).toContain('tsc -p packages/instance-registry/tsconfig.lib.json');
  });

  it('exposes affected PR gate commands for lint, unit, types, and runtime checks', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['test:eslint:affected']).toBe(
      'pnpm check:plugin-ui-boundary && pnpm check:plugin-architecture-boundary && env -u NO_COLOR nx affected --target=lint --base=${NX_BASE:-origin/main}'
    );
    expect(packageJson.scripts?.['test:unit:affected']).toBe('tsx scripts/ci/affected-unit-gate.ts --base ${NX_BASE:-origin/main}');
    expect(packageJson.scripts?.['test:types:affected']).toBe(
      'pnpm clean:generated-source-artifacts && env -u NO_COLOR nx affected --target=test:types --base=${NX_BASE:-origin/main} --parallel=1 && env -u NO_COLOR nx affected --target=typecheck --base=${NX_BASE:-origin/main} --parallel=1 && pnpm check:server-runtime:affected && pnpm exec tsc -p tsconfig.scripts.json --noEmit'
    );
    expect(packageJson.scripts?.['check:server-runtime:affected']).toBe(
      'env -u NO_COLOR NODE_OPTIONS="${NODE_OPTIONS:-} --import=./scripts/ci/node-listener-budget.mjs" nx affected --target=check:runtime --base=${NX_BASE:-origin/main} --parallel=1'
    );
  });

  it('keeps general integration scripts on the dedicated honest helper', () => {
    const packageJson = loadRootPackageJson();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();

    expect(packageJson.scripts?.['test:integration']).toBe('tsx scripts/ci/run-integration-gate.ts --mode full');
    expect(runtimeWorkflow).toContain(
      'pnpm exec tsx scripts/ci/run-integration-gate.ts --mode affected --base ${{ github.event.pull_request.base.sha }}'
    );
    expect(runtimeWorkflow).toContain('Monitoring-Checks laufen separat im Workflow `Monitoring Stack`.');
  });

  it('keeps PR quality workflows on the shared pr-scope helper', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();
    const e2eWorkflow = loadAppE2EWorkflow();

    expect(qualityWorkflow).toContain('name: Quality Gates');
    expect(runtimeWorkflow).toContain('name: Runtime Gates');
    expect(e2eWorkflow).toContain('name: App E2E');
    expect(qualityWorkflow).toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(runtimeWorkflow).toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(e2eWorkflow).toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(e2eWorkflow).toContain('pull_request:');
  });

  it('determines PR scope before conditionally starting Redis in runtime gates', () => {
    const workflow = loadRuntimeGatesWorkflow();
    const scopeIndex = workflow.indexOf('      - name: Determine PR scope');
    const startRedisIndex = workflow.indexOf('      - name: Start Redis for coverage tests');
    const waitRedisIndex = workflow.indexOf('      - name: Wait for Redis readiness');

    expect(scopeIndex).toBeGreaterThan(-1);
    expect(startRedisIndex).toBeGreaterThan(-1);
    expect(waitRedisIndex).toBeGreaterThan(-1);
    expect(scopeIndex).toBeLessThan(startRedisIndex);
    expect(startRedisIndex).toBeLessThan(waitRedisIndex);
  });

  it('keeps PR build validation on the shared pr-scope helper', () => {
    const mainBuildWorkflow = loadMainBuildWorkflow();

    expect(mainBuildWorkflow).toContain('pull_request:');
    expect(mainBuildWorkflow).toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(mainBuildWorkflow).toContain("steps.scope.outputs.app_build_mode != 'skip'");
    expect(mainBuildWorkflow).toContain("steps.scope.outputs.runtime_verify_mode != 'skip'");
    expect(mainBuildWorkflow).toContain('pnpm verify:runtime-artifact');
  });

  it('keeps the DB schema snapshot gate path-scoped in repository hygiene', () => {
    const workflow = loadRepositoryHygieneWorkflow();

    expect(workflow).toContain('name: DB Schema Snapshot');
    expect(workflow).toContain('uses: dorny/paths-filter@v4');
    expect(workflow).toContain("'packages/data/migrations/**'");
    expect(workflow).toContain("'docs/development/studio-db-schema-final.sql'");
    expect(workflow).toContain("'docs/development/studio-db-schema.md'");
    expect(workflow).toContain("'scripts/ci/check-db-schema-snapshot.ts'");
    expect(workflow).toContain('pnpm exec tsx scripts/ci/check-db-schema-snapshot.ts');
    expect(workflow).toContain('Median-Mehrlast <= 2 Minuten');
  });

  it('publishes App E2E summaries with the current workflow naming', () => {
    const e2eWorkflow = loadAppE2EWorkflow();

    expect(e2eWorkflow).toContain("echo 'App E2E abgeschlossen.' >> \"$GITHUB_STEP_SUMMARY\"");
    expect(e2eWorkflow).not.toContain('App-E2E-Smoke abgeschlossen.');
    expect(e2eWorkflow).toContain('Run app E2E tests');
    expect(e2eWorkflow).not.toContain('Run app E2E smoke tests');
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

  it('marks tooling-testing affected for workflow and CI-gate changes', () => {
    const nxJson = loadNxJson();
    const toolingTestingProject = loadToolingTestingProject();
    const namedInput = nxJson.namedInputs?.['ciGateTooling'] ?? [];
    const toolingScriptsInput = nxJson.namedInputs?.['toolingScripts'] ?? [];
    const lintInputs = (toolingTestingProject.targets?.lint as { inputs?: string[] } | undefined)?.inputs ?? [];
    const unitInputs = (toolingTestingProject.targets?.['test:unit'] as { inputs?: string[] } | undefined)?.inputs ?? [];
    const coverageInputs = (toolingTestingProject.targets?.['test:coverage'] as { inputs?: string[] } | undefined)?.inputs ?? [];

    expect(namedInput).toEqual(
      expect.arrayContaining([
        '{workspaceRoot}/package.json',
        '{workspaceRoot}/tsconfig.scripts.json',
        '{workspaceRoot}/.github/actions/**',
        '{workspaceRoot}/scripts/ci/**',
        '{workspaceRoot}/.github/workflows/**/*.yml',
        '{workspaceRoot}/.github/workflows/**/*.yaml',
      ])
    );
    expect(toolingScriptsInput).toEqual(expect.arrayContaining(['{workspaceRoot}/scripts/**']));
    expect(lintInputs).toContain('^production');
    expect(lintInputs).toContain('lintTooling');
    expect(lintInputs).toContain('ciGateTooling');
    expect(lintInputs).toContain('toolingScripts');
    expect(unitInputs).toContain('^production');
    expect(unitInputs).toContain('ciGateTooling');
    expect(unitInputs).toContain('toolingScripts');
    expect(coverageInputs).toContain('toolingScripts');
  });

  it('keeps the affected unit gate app-slice-aware', () => {
    const affectedUnitGate = loadAffectedUnitGateScript();
    const affectedCoverageGate = loadScript('scripts/ci/affected-coverage-gate.ts');
    const runPrGateScript = loadRunPrGateScript();

    expect(affectedUnitGate).toContain("export type AppUnitSlice = 'hooks' | 'routes' | 'server' | 'ui'");
    expect(affectedUnitGate).toContain("routes: 'apps/sva-studio-react/vitest.routes.config.ts'");
    expect(affectedUnitGate).toContain('return `pnpm exec vitest run --config ${configFile} --reporter=verbose`;');
    expect(affectedCoverageGate).toContain("const APP_VITEST_CONFIG = 'apps/sva-studio-react/vitest.config.ts';");
    expect(affectedCoverageGate).toContain('`pnpm exec vitest run --config ${APP_VITEST_CONFIG} --coverage --reporter=verbose`');
    expect(runPrGateScript).toContain('formatDurationSummary');
    expect(runPrGateScript).toContain('for (const entry of runAffectedUnitGate({ base, head }))');
  });
});
