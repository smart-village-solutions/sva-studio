import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = (name: string): string => path.join(rootDir, '.github/workflows', name);
const workflow = (name: string): string => fs.readFileSync(workflowPath(name), 'utf8');

describe('consolidated CI gate workflows', () => {
  const prGates = workflow('ci-gates-pr-shadow.yml');
  const mainGates = workflow('ci-gates-main-shadow.yml');

  it('publishes exactly the seven stable required names from the PR workflow', () => {
    expect(prGates).toContain('name: CI Gates (PR)');
    expect(prGates).toContain('on:\n  pull_request:');
    expect(prGates).not.toContain('\n  push:');

    const jobNames = [...prGates.matchAll(/^ {4}name: (.+)$/gmu)].map((match) => match[1]);
    for (const requiredName of [
      'Lint',
      'Unit',
      'Types',
      'Complexity',
      'PR Integration',
      'File Placement',
      'Coverage',
    ]) {
      expect(jobNames.filter((name) => name === requiredName)).toHaveLength(1);
    }
    expect(jobNames).not.toContain('CI Shadow / Parity');
    expect(prGates).not.toContain('CI Shadow');
  });

  it('computes the general PR scope exactly once and retains SHA-bound evidence', () => {
    expect(prGates.match(/pr-scope\.cli\.ts/gu)).toHaveLength(1);
    expect(prGates).not.toContain('dorny/paths-filter');
    expect(prGates).toContain('--base ${{ github.event.pull_request.base.sha }}');
    expect(prGates).toContain('--head ${{ github.event.pull_request.head.sha }}');
    expect(prGates).toContain('--evidence-path artifacts/ci-gates/pr-scope.json');
    expect(prGates).not.toContain('--legacy-evidence-path');
    expect(prGates).toContain('name: ci-gate-scope-${{ github.run_id }}');
  });

  it('keeps Unit and Coverage aggregation fail-closed', () => {
    expect(prGates).toContain('name: Unit Fast Feedback');
    expect(prGates).toContain('name: Unit Complete');
    expect(prGates).toContain('name: Unit');
    expect(prGates).toContain('--expected unit-direct,unit-remaining');
    expect(prGates).toContain('pattern: unit-feedback-*-${{ github.run_id }}');
    expect(prGates).toContain('name: Coverage Complete');
    expect(prGates).toContain('name: Coverage');
    expect(prGates).toContain('--expected coverage-complete');
    expect(prGates).toContain('validate-downloaded-coverage.ts');
    expect(prGates).toContain('if-no-files-found: error');
  });

  it('reuses all protected gate commands without deployment mutations', () => {
    for (const command of [
      'pnpm test:eslint:affected',
      'pnpm test:unit:affected --phase direct',
      'pnpm test:unit:affected --phase remaining',
      'pnpm test:types:affected',
      'pnpm test:coverage:affected',
      'pnpm sonar-new-code-gate --base=${{ github.event.pull_request.base.sha }}',
      'pnpm coverage-gate',
      'pnpm complexity-gate',
      'scripts/ci/run-integration-gate.ts --mode affected',
      'pnpm check:file-placement',
      'pnpm check:rollout-docs',
      'pnpm test:a11y',
      'pnpm nx run sva-studio-react:build',
      'pnpm verify:runtime-artifact',
      'pnpm check:docs',
      'sva-studio-react:check:documentation-catalog',
      'scripts/ci/check-db-schema-snapshot.ts',
    ]) {
      expect(prGates).toContain(command);
    }
    for (const forbidden of ['quantum-cli', 'docker stack deploy', 'environment:']) {
      expect(prGates).not.toContain(forbidden);
      expect(mainGates).not.toContain(forbidden);
    }
  });

  it('restores Codecov and Sonar writes exactly once without a second main app build', () => {
    expect(prGates.match(/uses: codecov\/codecov-action@v7/gu)).toHaveLength(1);
    expect(mainGates.match(/uses: codecov\/codecov-action@v7/gu)).toHaveLength(1);
    expect(mainGates.match(/uses: SonarSource\/sonarqube-scan-action@v7/gu)).toHaveLength(1);
    expect(mainGates).toContain('run: pnpm sonar:prepare-lcov');
    expect(mainGates).not.toContain('sva-studio-react:build');
  });

  it('checks out complete history before Main coverage and SonarCloud', () => {
    const coverageStart = mainGates.indexOf('\n  coverage:');
    const complexityStart = mainGates.indexOf('\n  complexity:', coverageStart);
    const coverageJob = mainGates.slice(coverageStart, complexityStart);

    expect(coverageJob).toContain('uses: actions/checkout@v7\n        with:\n          fetch-depth: 0');
    expect(coverageJob).not.toContain('filter: tree:0');
    expect(coverageJob).not.toContain('git fetch --unshallow');
    expect(coverageJob).not.toContain('git fetch --tags');
  });

  it('runs full Main and Nightly diagnostics without PR scope, PR cache, or parity', () => {
    expect(mainGates).toContain('name: CI Gates (Main and Nightly)');
    expect(mainGates).toContain('push:\n    branches:\n      - main');
    expect(mainGates).toContain("cron: '0 2 * * *'");
    expect(mainGates).not.toContain('pull_request:');
    expect(mainGates).not.toContain('pr-scope');
    expect(mainGates).not.toContain('actions/cache');
    expect(mainGates).not.toContain('test:unit:affected');
    expect(mainGates).not.toContain('test:coverage:affected');
    expect(mainGates).not.toContain('Parity');
    expect(mainGates).not.toContain('CI Shadow');
    expect(mainGates).toContain('pnpm test:unit');
    expect(mainGates).toContain('pnpm test:coverage');
    expect(mainGates).toContain('pnpm test:integration');
  });

  it('removes the four legacy workflows and parity implementation', () => {
    for (const removedWorkflow of [
      'quality-gates.yml',
      'runtime-gates.yml',
      'main-build.yml',
      'repository-hygiene.yml',
    ]) {
      expect(fs.existsSync(workflowPath(removedWorkflow))).toBe(false);
    }
    for (const removedScript of [
      'legacy-pr-scope.ts',
      'ci-gate-shadow-parity.ts',
      'ci-gate-shadow-parity.cli.ts',
      'ci-gate-main-shadow-parity.ts',
      'ci-gate-main-shadow-parity.cli.ts',
      'ci-gate-shadow-parity.test.ts',
    ]) {
      expect(fs.existsSync(path.join(rootDir, 'scripts/ci', removedScript))).toBe(false);
    }
  });

  it('keeps the release workflows independently named', () => {
    expect(workflow('build.yml')).toContain('name: Build');
    expect(workflow('app-e2e.yml')).toContain('name: App E2E');
    expect(workflow('promote.yml')).toContain('name: Promote');
  });
});
