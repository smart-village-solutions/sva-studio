import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = (name: string): string =>
  fs.readFileSync(path.join(rootDir, '.github/workflows', name), 'utf8');

describe('CI gate topology shadow workflows', () => {
  const prShadow = workflow('ci-gates-pr-shadow.yml');
  const mainShadow = workflow('ci-gates-main-shadow.yml');

  it('keeps the PR shadow non-required and on pull requests only', () => {
    expect(prShadow).toContain('name: CI Gate Topology Shadow (PR)');
    expect(prShadow).toContain('on:\n  pull_request:');
    expect(prShadow).not.toContain('\n  push:');
    expect(prShadow).not.toContain('\n  schedule:');

    const jobNames = [...prShadow.matchAll(/^ {4}name: (.+)$/gmu)].map((match) => match[1]);
    expect(jobNames.length).toBeGreaterThan(10);
    expect(jobNames.every((name) => name.startsWith('CI Shadow /'))).toBe(true);
    for (const requiredName of [
      'Lint',
      'Unit',
      'Types',
      'Complexity',
      'PR Integration',
      'File Placement',
      'Coverage',
    ]) {
      expect(jobNames).not.toContain(requiredName);
    }
  });

  it('computes the general PR scope exactly once and passes explicit event SHAs', () => {
    expect(prShadow.match(/pr-scope\.cli\.ts/gu)).toHaveLength(1);
    expect(prShadow).not.toContain('dorny/paths-filter');
    expect(prShadow).toContain('--base ${{ github.event.pull_request.base.sha }}');
    expect(prShadow).toContain('--head ${{ github.event.pull_request.head.sha }}');
    expect(prShadow).toContain('--evidence-path artifacts/ci-shadow/pr-scope.json');
    expect(prShadow).toContain('documentation_catalog_mode:');
    expect(prShadow).toContain('db_schema_mode:');
  });

  it('reuses the existing gate commands without deployment mutations', () => {
    for (const command of [
      'pnpm test:eslint:affected',
      'pnpm test:unit:affected --phase direct',
      'pnpm test:unit:affected --phase remaining',
      'pnpm test:types:affected',
      'pnpm test:coverage:affected',
      'pnpm sonar-new-code-gate',
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
      expect(prShadow).toContain(command);
    }
    for (const forbidden of ['quantum-cli', 'promote.yml', 'docker stack deploy', 'environment:']) {
      expect(prShadow).not.toContain(forbidden);
      expect(mainShadow).not.toContain(forbidden);
    }
  });

  it('compares exact-head terminal checks and retains parity evidence', () => {
    expect(prShadow).toContain('name: CI Shadow / Parity');
    expect(prShadow).toContain('commits/${HEAD_SHA}/check-runs?filter=latest&per_page=100');
    expect(prShadow).toContain('node scripts/ci/ci-gate-shadow-parity.ts');
    expect(prShadow).toContain('name: ci-gate-shadow-parity-${{ github.run_id }}');
    expect(prShadow).toContain('retention-days: 30');
  });

  it('runs full Main and Nightly diagnostics without PR scope, PR cache, or app build', () => {
    expect(mainShadow).toContain('name: CI Gate Topology Shadow (Main and Nightly)');
    expect(mainShadow).toContain('push:\n    branches:\n      - main');
    expect(mainShadow).toContain("cron: '30 2 * * *'");
    expect(mainShadow).not.toContain('pull_request:');
    expect(mainShadow).not.toContain('pr-scope');
    expect(mainShadow).not.toContain('actions/cache');
    expect(mainShadow).not.toContain('test:unit:affected');
    expect(mainShadow).not.toContain('test:coverage:affected');
    expect(mainShadow).not.toContain('sva-studio-react:build');
    expect(mainShadow).toContain('pnpm test:unit');
    expect(mainShadow).toContain('pnpm test:coverage');
    expect(mainShadow).toContain('pnpm test:integration');
  });

  it('leaves legacy required and release workflows independently named', () => {
    expect(workflow('quality-gates.yml')).toContain('  unit:\n    name: Unit');
    expect(workflow('runtime-gates.yml')).toContain('  coverage:\n    name: Coverage');
    expect(workflow('main-build.yml')).toContain('name: App Build');
    expect(workflow('repository-hygiene.yml')).toContain('name: File Placement');
    expect(workflow('build.yml')).toContain('name: Build');
    expect(workflow('app-e2e.yml')).toContain('name: App E2E');
    expect(workflow('promote.yml')).toContain('name: Promote');
  });
});
