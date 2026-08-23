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
  perProjectFloors: Record<
    string,
    { lines: number; statements: number; functions: number; branches: number }
  >;
}

interface TsConfigJson {
  include?: string[];
}

type NamedInputValue = string | { env: string };

interface NxProjectJson {
  targets?: Record<
    string,
    {
      cache?: boolean;
      dependsOn?: string[];
      options?: { command?: string; lintFilePatterns?: string[] };
    }
  >;
}

interface NxJson {
  namedInputs?: Record<string, NamedInputValue[]>;
  nxCloudId?: string;
  neverConnectToCloud?: boolean;
  targetDefaults?: Record<string, { cache?: boolean }>;
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

function loadDockerignore(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(path.join(rootDir, '.dockerignore'), 'utf8');
}

function loadScriptsTsConfig(): TsConfigJson {
  const rootDir = resolveRootDir();
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tsconfig.scripts.json'), 'utf8')
  ) as TsConfigJson;
}

function loadToolingTestingProject(): NxProjectJson {
  const rootDir = resolveRootDir();
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tooling/testing/project.json'), 'utf8')
  ) as NxProjectJson;
}

function loadProjectJson(projectPath: string): NxProjectJson {
  const rootDir = resolveRootDir();
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, projectPath, 'project.json'), 'utf8')
  ) as NxProjectJson;
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

function loadWorkspaceSetupAction(): string {
  const rootDir = resolveRootDir();
  return fs.readFileSync(
    path.join(rootDir, '.github/actions/setup-pnpm-workspace/action.yml'),
    'utf8'
  );
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

function loadNxJson(): NxJson {
  const rootDir = resolveRootDir();
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'nx.json'), 'utf8')) as NxJson;
}

describe('workspace package scripts', () => {
  it('keeps branch-weighted new-code coverage enforcement in the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const testPrScript = packageJson.scripts?.['test:pr'];
    const runPrGateScript = loadRunPrGateScript();

    expect(testPrScript).toBe(
      'bash scripts/ci/run-workspace-node.sh --import tsx scripts/ci/run-pr-gate.ts'
    );
    expect(runPrGateScript).toContain('pnpm sonar-new-code-gate --base=${base}');
    expect(runPrGateScript).not.toContain('pnpm patch-coverage-gate --base=${base}');
  });

  it('keeps studio release verification outside the standard PR gate', () => {
    const packageJson = loadRootPackageJson();
    const releaseScript = packageJson.scripts?.['test:release:studio'];

    expect(packageJson.scripts?.['test:pr']).not.toContain('pnpm verify:runtime-artifact');
    expect(releaseScript).toBe('pnpm test:pr && pnpm verify:runtime-artifact');
  });

  it('keeps plugin boundary enforcement in PR and CI gates', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['check:plugin-ui-boundary']).toBe(
      'tsx scripts/ci/check-plugin-ui-boundary.ts'
    );
    expect(packageJson.scripts?.['check:plugin-architecture-boundary']).toBe(
      'tsx scripts/ci/check-plugin-architecture-boundary.ts'
    );
    expect(packageJson.scripts?.['test:eslint']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:eslint']).toContain(
      'pnpm check:plugin-architecture-boundary'
    );
    expect(packageJson.scripts?.['test:ci']).toContain('pnpm check:plugin-ui-boundary');
    expect(packageJson.scripts?.['test:ci']).toContain('pnpm check:plugin-architecture-boundary');
  });

  it('keeps the dedicated PR coverage command aligned with the branch-weighted gate', () => {
    const packageJson = loadRootPackageJson();
    const testCoveragePrScript = packageJson.scripts?.['test:coverage:pr'];

    expect(testCoveragePrScript).toContain(
      'pnpm sonar-new-code-gate --base=${NX_BASE:-origin/main}'
    );
    expect(testCoveragePrScript).not.toContain('pnpm patch-coverage-gate');
  });

  it('keeps full PR coverage regression checks enabled in runtime gates', () => {
    const runtimeGatesWorkflow = loadRuntimeGatesWorkflow();

    expect(runtimeGatesWorkflow).toContain('NX_HEAD: ${{ github.event.pull_request.head.sha }}');
    expect(runtimeGatesWorkflow).toContain(
      "NX_RUN_FULL: ${{ steps.scope.outputs.coverage_mode == 'full' && '1' || '0' }}"
    );
    expect(runtimeGatesWorkflow).toContain('run: pnpm test:coverage:affected');
    expect(runtimeGatesWorkflow).toContain(
      "COVERAGE_GATE_REQUIRE_SUMMARIES: ${{ steps.scope.outputs.coverage_mode == 'full' && '1' || '0' }}"
    );
    expect(runtimeGatesWorkflow).not.toContain('COVERAGE_GATE_PROJECT_FILTER');
  });

  it('keeps Unit fail-closed and Coverage aggregation in shadow mode', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();

    expect(qualityWorkflow).toContain('unit-fast-feedback:');
    expect(qualityWorkflow).toContain('unit-complete:');
    expect(qualityWorkflow).toContain('  unit:\n    name: Unit');
    expect(qualityWorkflow).toContain('--expected unit-direct,unit-remaining');
    expect(qualityWorkflow).toContain('if-no-files-found: error');
    expect(runtimeWorkflow).toContain('coverage-complete:\n    name: Coverage');
    expect(runtimeWorkflow).toContain('  coverage:\n    name: Coverage Shadow');
    expect(runtimeWorkflow).toContain('--expected coverage-complete');
    expect(runtimeWorkflow).toContain('validate-downloaded-coverage.ts');
  });

  it('requires both internal Unit jobs to succeed before accepting evidence', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const unitAggregatorStart = qualityWorkflow.indexOf('  unit:\n    name: Unit');
    const typesStart = qualityWorkflow.indexOf('\n  types:', unitAggregatorStart);
    const unitAggregator = qualityWorkflow.slice(unitAggregatorStart, typesStart);
    const fastResultCheck = unitAggregator.indexOf('test "$FAST_RESULT" = "success"');
    const completeResultCheck = unitAggregator.indexOf('test "$COMPLETE_RESULT" = "success"');
    const evidenceRequiredBranch = unitAggregator.indexOf(
      'if [ "$EVIDENCE_REQUIRED" != "true" ]; then'
    );
    const evidenceAggregation = unitAggregator.indexOf('node scripts/ci/ci-feedback-aggregate.ts');

    expect(fastResultCheck).toBeGreaterThan(-1);
    expect(completeResultCheck).toBeGreaterThan(-1);
    expect(fastResultCheck).toBeLessThan(evidenceRequiredBranch);
    expect(completeResultCheck).toBeLessThan(evidenceRequiredBranch);
    expect(evidenceRequiredBranch).toBeLessThan(evidenceAggregation);
  });

  it('sets up the repository Node runtime before running TypeScript aggregators', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();
    const unitAggregatorStart = qualityWorkflow.indexOf('  unit:\n    name: Unit');
    const typesStart = qualityWorkflow.indexOf('\n  types:', unitAggregatorStart);
    const unitAggregator = qualityWorkflow.slice(unitAggregatorStart, typesStart);
    const coverageAggregatorStart = runtimeWorkflow.indexOf(
      '  coverage:\n    name: Coverage Shadow'
    );
    const complexityStart = runtimeWorkflow.indexOf('\n  complexity:', coverageAggregatorStart);
    const coverageAggregator = runtimeWorkflow.slice(coverageAggregatorStart, complexityStart);

    for (const aggregator of [unitAggregator, coverageAggregator]) {
      const setupNodeIndex = aggregator.indexOf('uses: actions/setup-node@v6');
      const nodeVersionIndex = aggregator.indexOf('node-version-file: .nvmrc');
      const evidenceAggregationIndex = aggregator.indexOf(
        'node scripts/ci/ci-feedback-aggregate.ts'
      );

      expect(setupNodeIndex).toBeGreaterThan(-1);
      expect(nodeVersionIndex).toBeGreaterThan(setupNodeIndex);
      expect(nodeVersionIndex).toBeLessThan(evidenceAggregationIndex);
    }
  });

  it('runs direct Unit feedback independently from the complete PR scope', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const fastFeedbackStart = qualityWorkflow.indexOf('  unit-fast-feedback:');
    const completeStart = qualityWorkflow.indexOf('  unit-complete:');
    const fastFeedbackBlock = qualityWorkflow.slice(fastFeedbackStart, completeStart);

    expect(fastFeedbackBlock).toContain('pnpm test:unit:affected --phase direct');
    expect(fastFeedbackBlock).not.toContain('needs:');
    expect(qualityWorkflow).toContain('pnpm test:unit:affected --phase remaining');
  });

  it('retains complete diagnostics on main and nightly execution paths', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const e2eWorkflow = loadAppE2EWorkflow();

    expect(qualityWorkflow).toContain('Run complete main unit diagnostics');
    expect(qualityWorkflow).toContain('run: pnpm test:unit');
    expect(e2eWorkflow).toContain('schedule:');
    expect(e2eWorkflow).toContain("PLAYWRIGHT_MAX_FAILURES: '0'");
  });

  it('exposes the Sonar LCOV preparation command', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['sonar:prepare-lcov']).toBe(
      'tsx scripts/ci/prepare-sonar-lcov.ts'
    );
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

  it('keeps coverage floors for the expanded studio UI package binding', () => {
    const policy = loadCoveragePolicy();

    expect(policy.perProjectFloors['studio-ui-react']).toEqual({
      lines: 85,
      statements: 85,
      functions: 82,
      branches: 74,
    });
  });

  it('exposes a dedicated local studio release command', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['env:release:studio:local']).toBe(
      'tsx scripts/ops/studio-release-local.ts'
    );
  });

  it('keeps studio image verify tag sanitizing portable on GitHub runners', () => {
    const workflow = loadStudioImageVerifyWorkflow();

    expect(workflow).toContain(
      'safe_tag="$(printf \'%s\' "${IMAGE_TAG}" | sed -E \'s/[^[:alnum:]. _-]+/-/g; s/[[:space:]]+/-/g; s/-+/-/g; s/^-+//; s/-+$//\')"'
    );
    expect(workflow).not.toContain("tr -cs '[:alnum:]._- ' '-'");
  });

  it('keeps git out of the Docker build context', () => {
    expect(loadDockerignore()).toContain('.git');
  });

  it('runs type gates through workspace-wide Nx targets instead of hard-coded project lists', () => {
    const packageJson = loadRootPackageJson();
    const typesScript = packageJson.scripts?.['test:types'];

    expect(typesScript).toContain('nx run-many -t test:types --parallel=1');
    expect(typesScript).toContain('nx run-many -t typecheck --parallel=1');
    expect(typesScript).not.toContain('--projects=');
  });

  it('runs full coverage serially to keep UI test timing stable on shared runners', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['test:coverage']).toBe(
      'env -u NO_COLOR nx run-many -t test:coverage --parallel=1'
    );
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
      'pnpm check:app-boundaries && pnpm check:plugin-ui-boundary && pnpm check:plugin-architecture-boundary && pnpm check:boundaries:fallow && env -u NO_COLOR nx affected --target=lint --base=${NX_BASE:-origin/main}'
    );
    expect(packageJson.scripts?.['test:unit:affected']).toBe(
      'tsx scripts/ci/affected-unit-gate.ts --base ${NX_BASE:-origin/main} --head ${NX_HEAD:-HEAD}'
    );
    expect(packageJson.scripts?.['test:coverage:affected']).toBe(
      'tsx scripts/ci/affected-coverage-gate.ts --base ${NX_BASE:-origin/main} --head ${NX_HEAD:-HEAD}'
    );
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

    expect(packageJson.scripts?.['test:integration']).toBe(
      'tsx scripts/ci/run-integration-gate.ts --mode full'
    );
    expect(runtimeWorkflow).toContain(
      'pnpm exec tsx scripts/ci/run-integration-gate.ts --mode affected --base ${{ github.event.pull_request.base.sha }}'
    );
    expect(runtimeWorkflow).toContain(
      'Monitoring-Checks laufen separat im Workflow `Monitoring Stack`.'
    );
  });

  it('cleans stale local studio serve processes before running app e2e', () => {
    const packageJson = loadRootPackageJson();

    expect(packageJson.scripts?.['test:e2e']).toBe(
      'tsx scripts/ci/cleanup-e2e-webserver-conflicts.ts --port 3000 && env -u NO_COLOR nx run sva-studio-react:test:e2e'
    );
  });

  it('keeps PR quality workflows on the shared pr-scope helper', () => {
    const qualityWorkflow = loadQualityGatesWorkflow();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();
    const e2eWorkflow = loadAppE2EWorkflow();

    expect(qualityWorkflow).toContain('name: Quality Gates');
    expect(runtimeWorkflow).toContain('name: Runtime Gates');
    expect(e2eWorkflow).toContain('name: App E2E');
    expect(qualityWorkflow).toContain(
      'tsx scripts/ci/pr-scope.cli.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(qualityWorkflow).toContain(
      "NX_RUN_FULL: ${{ steps.scope.outputs.quality_gate_mode == 'full' && '1' || '0' }}"
    );
    expect(qualityWorkflow).not.toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(runtimeWorkflow).toContain(
      'tsx scripts/ci/pr-scope.cli.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(runtimeWorkflow).not.toContain(
      'tsx scripts/ci/pr-scope.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
    );
    expect(e2eWorkflow).not.toContain('pr-scope.cli.ts');
    expect(e2eWorkflow).not.toContain('pull_request:');
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

  it('requires the complete coverage job before accepting downloaded evidence', () => {
    const workflow = loadRuntimeGatesWorkflow();
    const aggregateStep = workflow.slice(workflow.indexOf('Aggregate required Coverage status'));
    const resultCheckIndex = aggregateStep.indexOf('test "$COMPLETE_RESULT" = "success"');
    const evidenceCheckIndex = aggregateStep.indexOf('node scripts/ci/ci-feedback-aggregate.ts');

    expect(resultCheckIndex).toBeGreaterThan(-1);
    expect(evidenceCheckIndex).toBeGreaterThan(-1);
    expect(resultCheckIndex).toBeLessThan(evidenceCheckIndex);
  });

  it('keeps PR build validation on the shared pr-scope helper', () => {
    const mainBuildWorkflow = loadMainBuildWorkflow();

    expect(mainBuildWorkflow).toContain('pull_request:');
    expect(mainBuildWorkflow).toContain(
      'tsx scripts/ci/pr-scope.cli.ts --base ${{ github.event.pull_request.base.sha }} --github-output'
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

  it('runs full App E2E only for main pushes and diagnostic invocations', () => {
    const e2eWorkflow = loadAppE2EWorkflow();

    expect(e2eWorkflow).toContain('push:');
    expect(e2eWorkflow).toContain('branches: [main]');
    expect(e2eWorkflow).toContain('schedule:');
    expect(e2eWorkflow).toContain('workflow_dispatch:');
    expect(e2eWorkflow).not.toContain('pull_request:');
    expect(e2eWorkflow).toContain('Run complete app E2E suite uncached');
    expect(e2eWorkflow).toContain('sva-studio-react:test:e2e --skipNxCache');
    expect(e2eWorkflow).toContain("PLAYWRIGHT_MAX_FAILURES: '0'");
    expect(e2eWorkflow).toContain('Write redacted App E2E evidence');
  });

  it('caches pnpm dependencies without restoring Nx local artifacts across runners', () => {
    const setupAction = loadWorkspaceSetupAction();

    expect(setupAction).toContain('uses: actions/setup-node@v6');
    expect(setupAction).toContain('cache: pnpm');
    expect(setupAction).not.toContain('uses: actions/cache@');
    expect(setupAction).not.toContain('path: .nx/cache');
    expect(setupAction).not.toContain('nx-cache-scope');
    expect(setupAction).not.toContain('nxCloudId');
  });

  it('recomputes Nx targets instead of trusting a missing, rejected, or damaged remote restore', () => {
    const setupAction = loadWorkspaceSetupAction();
    const qualityWorkflow = loadQualityGatesWorkflow();
    const runtimeWorkflow = loadRuntimeGatesWorkflow();

    expect(setupAction).toContain('NX_NO_CLOUD=true');
    expect(setupAction).not.toContain('path: .nx/cache');
    expect(qualityWorkflow).toContain('pnpm test:unit:affected --phase direct');
    expect(qualityWorkflow).toContain('pnpm test:unit:affected --phase remaining');
    expect(runtimeWorkflow).toContain('run: pnpm test:coverage:affected');
  });

  it('typechecks all CI gate sources via tsconfig.scripts.json', () => {
    const tsconfig = loadScriptsTsConfig();

    expect(tsconfig.include).toEqual(
      expect.arrayContaining(['scripts/ci/**/*.ts', 'scripts/ops/**/*.ts'])
    );
  });

  it('lints TypeScript script sources through the tooling-testing project', () => {
    const toolingTestingProject = loadToolingTestingProject();
    const lintPatterns = toolingTestingProject.targets?.lint?.options?.lintFilePatterns ?? [];

    expect(lintPatterns).toEqual(
      expect.arrayContaining(['tooling/testing/tests/**/*.{ts,tsx,js,jsx}', 'scripts/**/*.ts'])
    );
  });

  it('uses the shared Vitest wrapper so Nx test-file filters work for tooling tests', () => {
    const toolingTestingProject = loadToolingTestingProject();
    const unitCommand = toolingTestingProject.targets?.['test:unit']?.options?.command;
    const coverageCommand = toolingTestingProject.targets?.['test:coverage']?.options?.command;

    expect(unitCommand).toContain('scripts/ci/run-vitest-target.ts');
    expect(unitCommand).toContain('--config vitest.config.ts');
    expect(unitCommand).not.toContain(' tests ');
    expect(unitCommand).not.toContain('../../scripts/');
    expect(coverageCommand).toContain('scripts/ci/run-vitest-target.ts');
    expect(coverageCommand).toContain('--config vitest.config.ts');
    expect(coverageCommand).not.toContain(' tests ');
    expect(coverageCommand).not.toContain('../../scripts/');
  });

  it('verifies and synchronizes the auth runtime before executing tooling runtime tests', () => {
    const toolingTestingProject = loadToolingTestingProject();
    const authRuntimeProject = loadProjectJson('packages/auth-runtime');

    expect(toolingTestingProject.targets?.['test:unit']?.dependsOn).toContain(
      'auth-runtime:check:runtime'
    );
    expect(toolingTestingProject.targets?.['test:coverage']?.dependsOn).toContain(
      'auth-runtime:check:runtime'
    );
    expect(authRuntimeProject.targets?.['check:runtime']?.cache).toBe(false);
  });

  it('marks tooling-testing affected for workflow and CI-gate changes', () => {
    const nxJson = loadNxJson();
    const toolingTestingProject = loadToolingTestingProject();
    const namedInput = nxJson.namedInputs?.['ciGateTooling'] ?? [];
    const toolingScriptsInput = nxJson.namedInputs?.['toolingScripts'] ?? [];
    const lintInputs =
      (toolingTestingProject.targets?.lint as { inputs?: string[] } | undefined)?.inputs ?? [];
    const unitInputs =
      (toolingTestingProject.targets?.['test:unit'] as { inputs?: string[] } | undefined)?.inputs ??
      [];
    const coverageInputs =
      (toolingTestingProject.targets?.['test:coverage'] as { inputs?: string[] } | undefined)
        ?.inputs ?? [];

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

  it('keeps Nx Cloud disabled while leaving coverage runs uncached', () => {
    const nxJson = loadNxJson();
    const coverageTarget = nxJson.targetDefaults?.['test:coverage'];

    expect(nxJson.nxCloudId).toBeUndefined();
    expect(nxJson.neverConnectToCloud).toBe(true);
    expect(coverageTarget?.cache).toBe(false);
    expect(loadProjectJson('apps/sva-studio-react').targets?.['test:coverage']?.cache).toBe(false);
    expect(loadProjectJson('apps/sva-studio-react').targets?.['test:e2e']?.cache).toBe(false);
    expect(
      loadProjectJson('apps/public-waste-calendar-web').targets?.['test:coverage']?.cache
    ).toBe(false);
    expect(loadProjectJson('apps/project-report').targets?.['test:coverage']?.cache).toBe(false);
  });

  it('uses the configured Node version file during workspace setup', () => {
    const workspaceSetupAction = loadWorkspaceSetupAction();

    expect(workspaceSetupAction).toContain('node-version-file: ${{ inputs.node-version-file }}');
  });

  it('keeps the affected unit gate app-slice-aware', () => {
    const affectedUnitGate = loadAffectedUnitGateScript();
    const affectedUnitPlan = loadScript('scripts/ci/affected-unit-plan.ts');
    const affectedCoverageGate = loadScript('scripts/ci/affected-coverage-gate.ts');
    const runPrGateScript = loadRunPrGateScript();

    expect(affectedUnitPlan).toContain(
      "export type AppUnitSlice = 'hooks' | 'routes' | 'server' | 'ui'"
    );
    expect(affectedUnitPlan).toContain(
      "const target = slice ? `test:unit:${slice}` : 'test:unit';"
    );
    expect(affectedUnitPlan).toContain('return `pnpm nx run ${APP_PROJECT}:${target}`;');
    expect(affectedUnitGate).toContain("from './affected-unit-plan.ts'");
    expect(affectedUnitGate).toContain("from './changed-project-plan.ts'");
    expect(affectedUnitGate).toContain('--nxBail');
    expect(affectedUnitGate).not.toContain('buildAppUnitCommand()} --nxBail');
    expect(affectedUnitGate).not.toContain('buildAppUnitCommand(slice)} --nxBail');
    expect(affectedUnitGate).not.toContain('retries: 1');
    expect(affectedCoverageGate).toContain('`pnpm nx run ${APP_PROJECT}:test:coverage`');
    expect(runPrGateScript).toContain('formatDurationSummary');
    expect(runPrGateScript).toContain('for (const entry of runAffectedUnitGate({ base, head }))');
  });
});
