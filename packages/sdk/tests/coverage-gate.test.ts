import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCoverageGate } from '../../../scripts/ci/coverage-gate.ts';

const createdDirs: string[] = [];

function createTempWorkspace(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-gate-'));
  createdDirs.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'apps'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tooling/testing'), { recursive: true });
  return rootDir;
}

function writePolicy(rootDir: string, overrides: Record<string, unknown> = {}): void {
  const basePolicy = {
    version: 1,
    metrics: ['lines', 'statements', 'functions', 'branches'],
    globalFloors: {
      lines: 0,
      statements: 0,
      functions: 0,
      branches: 0,
    },
    maxAllowedDropPctPoints: 0.5,
    exemptProjects: [],
    perProjectFloors: {
      sdk: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
      },
    },
  };

  const policy = {
    ...basePolicy,
    ...overrides,
  };

  fs.writeFileSync(
    path.join(rootDir, 'tooling/testing/coverage-policy.json'),
    JSON.stringify(policy, null, 2)
  );
}

function writeBaseline(rootDir: string, lines = 0, statements = 0, functions = 0, branches = 0): void {
  const baseline = {
    projects: {
      sdk: {
        lines,
        statements,
        functions,
        branches,
      },
    },
  };

  fs.writeFileSync(
    path.join(rootDir, 'tooling/testing/coverage-baseline.json'),
    JSON.stringify(baseline, null, 2)
  );
}

function writeCoverageSummary(rootDir: string, lines = 0, statements = 0, functions = 0, branches = 0): void {
  const summaryPath = path.join(rootDir, 'packages/sdk/coverage');
  fs.mkdirSync(summaryPath, { recursive: true });

  const summary = {
    total: {
      lines: { pct: lines },
      statements: { pct: statements },
      functions: { pct: functions },
      branches: { pct: branches },
    },
  };

  fs.writeFileSync(path.join(summaryPath, 'coverage-summary.json'), JSON.stringify(summary, null, 2));
}

afterEach(() => {
  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('coverage gate', () => {
  it('fails when policy file is missing', () => {
    const rootDir = createTempWorkspace();

    expect(() =>
      runCoverageGate({
        rootDir,
        requireSummaries: true,
      })
    ).toThrow(/Coverage policy not found/);
  });

  it('fails when coverage summaries are required but absent', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir);
    writeBaseline(rootDir);

    expect(() =>
      runCoverageGate({
        rootDir,
        requireSummaries: true,
      })
    ).toThrow(/No coverage-summary\.json files found/);
  });

  it('fails when per-project floor is not met', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      perProjectFloors: {
        sdk: {
          lines: 70,
          statements: 70,
          functions: 70,
          branches: 70,
        },
      },
    });
    writeBaseline(rootDir);
    writeCoverageSummary(rootDir, 10, 10, 10, 10);

    const result = runCoverageGate({ rootDir, requireSummaries: true });

    expect(result.passed).toBe(false);
    expect(result.errors.some((error) => error.includes('below floor'))).toBe(true);
  });

  it('fails when baseline drop exceeds configured threshold', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, { maxAllowedDropPctPoints: 0.5 });
    writeBaseline(rootDir, 90, 90, 90, 90);
    writeCoverageSummary(rootDir, 80, 80, 80, 80);

    const result = runCoverageGate({ rootDir, requireSummaries: true });

    expect(result.passed).toBe(false);
    expect(result.errors.some((error) => error.includes('dropped by'))).toBe(true);
  });

  it('throws for invalid policy structure', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      metrics: ['invalid-metric'],
    });
    writeBaseline(rootDir);
    writeCoverageSummary(rootDir, 80, 80, 80, 80);

    expect(() => runCoverageGate({ rootDir, requireSummaries: true })).toThrow(/Invalid coverage policy/);
  });

  it('passes and updates baseline with current summaries', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir);
    writeBaseline(rootDir);
    writeCoverageSummary(rootDir, 33, 44, 55, 66);

    const updateResult = runCoverageGate({ rootDir, updateBaseline: true, requireSummaries: true });
    expect(updateResult.updatedBaseline).toBe(true);

    const baseline = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tooling/testing/coverage-baseline.json'), 'utf8')
    ) as {
      projects: { sdk: { lines: number; statements: number; functions: number; branches: number } };
    };

    expect(baseline.projects.sdk.lines).toBe(33);
    expect(baseline.projects.sdk.statements).toBe(44);
    expect(baseline.projects.sdk.functions).toBe(55);
    expect(baseline.projects.sdk.branches).toBe(66);
  });
});
