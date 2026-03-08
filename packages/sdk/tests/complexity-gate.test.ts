/* eslint-disable @nx/enforce-module-boundaries */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { analyzeFile, runComplexityGate } from '../../../scripts/ci/complexity-gate.ts';

const createdDirs: string[] = [];

function createTempWorkspace(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-gate-'));
  createdDirs.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'packages/auth/src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tooling/quality'), { recursive: true });
  return rootDir;
}

function writePolicy(rootDir: string, overrides: Record<string, unknown> = {}): void {
  const basePolicy = {
    version: 1,
    classThresholds: {
      zentral: {
        fileLines: 999,
        functionLines: 999,
        cyclomaticComplexity: 999,
        publicExports: 999,
      },
      kritisch: {
        fileLines: 5,
        functionLines: 4,
        cyclomaticComplexity: 3,
        publicExports: 1,
      },
    },
    modules: [
      {
        id: 'iam-server',
        label: 'IAM Server',
        class: 'kritisch',
        owner: 'team-iam',
        reviewCadence: 'pro-pr',
        include: ['packages/auth/src/**/*.ts'],
        exclude: ['**/*.test.ts'],
      },
    ],
    trackedFindings: {},
  };

  fs.writeFileSync(
    path.join(rootDir, 'tooling/quality/complexity-policy.json'),
    JSON.stringify(
      {
        ...basePolicy,
        ...overrides,
      },
      null,
      2
    ) + '\n'
  );
}

function writeSourceFile(rootDir: string, fileName: string, source: string): string {
  const filePath = path.join(rootDir, 'packages/auth/src', fileName);
  fs.writeFileSync(filePath, source);
  return filePath;
}

afterEach(() => {
  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('complexity gate', () => {
  it('analyzes file metrics from TypeScript source', () => {
    const rootDir = createTempWorkspace();
    const filePath = writeSourceFile(
      rootDir,
      'example.ts',
      [
        'export function handler(input: string): string {',
        "  if (input === 'a' || input === 'b') {",
        "    return input === 'a' ? 'A' : 'B';",
        '  }',
        "  return 'C';",
        '}',
        '',
        'export const value = 1;',
      ].join('\n')
    );

    const metrics = analyzeFile(filePath, 'packages/auth/src/example.ts');

    expect(metrics.fileLines).toBe(8);
    expect(metrics.maxFunctionLines).toBe(6);
    expect(metrics.maxCyclomaticComplexity).toBe(4);
    expect(metrics.publicExports).toBe(2);
  });

  it('fails when the policy file is missing', () => {
    const rootDir = createTempWorkspace();

    expect(() => runComplexityGate({ rootDir })).toThrow(/Complexity policy not found/);
  });

  it('fails for untracked findings above threshold', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir);
    writeSourceFile(
      rootDir,
      'large.ts',
      [
        'export function largeHandler(input: string): string {',
        '  const value = input.trim();',
        "  if (value === '') {",
        "    return 'fallback';",
        '  }',
        '  return value;',
        '}',
      ].join('\n')
    );

    const result = runComplexityGate({ rootDir, stepSummaryPath: null });

    expect(result.passed).toBe(false);
    expect(result.untrackedViolations.length).toBeGreaterThan(0);
    expect(result.untrackedViolations.some((violation) => violation.metric === 'fileLines')).toBe(true);
    expect(result.summaryBody).toContain('Neue Findings ohne Ticket');
  });

  it('passes when findings are linked to refactoring tickets', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      trackedFindings: {
        'iam-server:packages/auth/src/large.ts:fileLines': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'open',
          summary: 'Datei splitten',
        },
        'iam-server:packages/auth/src/large.ts:functionLines': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'open',
          summary: 'Datei splitten',
        },
        'iam-server:packages/auth/src/large.ts:cyclomaticComplexity': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'open',
          summary: 'Datei splitten',
        },
      },
    });
    writeSourceFile(
      rootDir,
      'large.ts',
      [
        'export function largeHandler(input: string): string {',
        '  const value = input.trim();',
        "  if (value === '') {",
        "    return 'fallback';",
        '  }',
        '  return value;',
        '}',
      ].join('\n')
    );

    const result = runComplexityGate({ rootDir, stepSummaryPath: null });

    expect(result.passed).toBe(true);
    expect(result.trackedViolations).toHaveLength(2);
    expect(result.summaryBody).toContain('Getrackte Findings');
    expect(result.summaryBody).toContain('backlog:QUAL-1');
  });

  it('updates the baseline with current file metrics', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      classThresholds: {
        zentral: {
          fileLines: 999,
          functionLines: 999,
          cyclomaticComplexity: 999,
          publicExports: 999,
        },
        kritisch: {
          fileLines: 999,
          functionLines: 999,
          cyclomaticComplexity: 999,
          publicExports: 999,
        },
      },
    });
    writeSourceFile(
      rootDir,
      'baseline.ts',
      ['export function example(): number {', '  return 1;', '}'].join('\n')
    );

    const result = runComplexityGate({ rootDir, updateBaseline: true, stepSummaryPath: null });
    expect(result.updatedBaseline).toBe(true);

    const baseline = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tooling/quality/complexity-baseline.json'), 'utf8')
    ) as {
      files: Record<string, { fileLines: number; functionLines: number; cyclomaticComplexity: number }>;
    };

    expect(baseline.files['packages/auth/src/baseline.ts'].fileLines).toBe(3);
    expect(baseline.files['packages/auth/src/baseline.ts'].functionLines).toBe(3);
    expect(baseline.files['packages/auth/src/baseline.ts'].cyclomaticComplexity).toBe(1);
  });
});
