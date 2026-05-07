import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { analyzeFile, runComplexityGate } from '../../../scripts/ci/complexity-gate.ts';

const createdDirs: string[] = [];

function createTempWorkspace(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-gate-'));
  createdDirs.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'packages/iam-target/src'), { recursive: true });
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
        include: ['packages/iam-target/src/**/*.ts'],
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
  const filePath = path.join(rootDir, 'packages/iam-target/src', fileName);
  fs.writeFileSync(filePath, source);
  return filePath;
}

afterEach(() => {
  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('complexity gate', () => {
  it('covers the central production modules with only narrow exclusions', () => {
    const policy = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'tooling/quality/complexity-policy.json'), 'utf8')
    ) as {
      modules: Array<{ id: string; exclude?: string[]; priority?: number }>;
    };

    expect(policy.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining([
        'packages-default',
        'apps-default',
        'scripts-default',
        'routing',
        'core-security',
        'core-iam',
        'iam-data',
        'instance-registry-data',
        'instance-registry-repositories',
        'auth-runtime',
        'iam-admin',
        'iam-governance',
        'instance-registry-service',
        'plugin-sdk',
        'plugin-news',
        'sva-mainserver',
        'frontend-app',
        'ci-scripts',
        'ops-scripts',
      ])
    );

    expect(policy.modules.some((module) => (module.priority ?? 0) > 0)).toBe(true);

    for (const module of policy.modules) {
      expect(module.exclude ?? []).toEqual(
        expect.arrayContaining(
          (module.exclude ?? []).filter(
            (pattern) =>
              pattern !== '**/*.test.ts' &&
              pattern !== '**/*.test.tsx' &&
              pattern !== 'packages/sva-mainserver/src/generated/**/*.ts'
          )
        )
      );
      expect(
        (module.exclude ?? []).every(
          (pattern) =>
            pattern === '**/*.test.ts' ||
            pattern === '**/*.test.tsx' ||
            pattern === 'packages/sva-mainserver/src/generated/**/*.ts'
        )
      ).toBe(true);
    }
  });

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

    const metrics = analyzeFile(filePath, 'packages/iam-target/src/example.ts');

    expect(metrics.fileLines).toBe(8);
    expect(metrics.maxFunctionLines).toBe(6);
    expect(metrics.maxCyclomaticComplexity).toBe(4);
    expect(metrics.publicExports).toBe(2);
  });

  it('fails when the policy file is missing', () => {
    const rootDir = createTempWorkspace();

    expect(() => runComplexityGate({ rootDir })).toThrow(/Complexity policy not found/);
  });

  it('throws for invalid tracked finding status', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      trackedFindings: {
        'iam-server:packages/iam-target/src/large.ts:fileLines': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'todo',
          summary: 'invalid status',
        },
      },
    });
    writeSourceFile(rootDir, 'large.ts', 'export const value = 1;\n');

    expect(() => runComplexityGate({ rootDir, stepSummaryPath: null })).toThrow(/Invalid complexity policy/);
  });

  it('prefers the higher priority module when include patterns overlap', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      modules: [
        {
          id: 'default',
          label: 'Default',
          class: 'zentral',
          owner: 'team-platform',
          reviewCadence: 'pro-pr',
          include: ['packages/**/*.ts'],
          exclude: ['**/*.test.ts'],
        },
        {
          id: 'iam-server',
          label: 'IAM Server',
          class: 'kritisch',
          owner: 'team-iam',
          reviewCadence: 'pro-pr',
          include: ['packages/iam-target/src/**/*.ts'],
          exclude: ['**/*.test.ts'],
          priority: 10,
        },
      ],
    });
    writeSourceFile(rootDir, 'priority.ts', 'export const value = 1;\n');

    const result = runComplexityGate({ rootDir, stepSummaryPath: null });

    expect(result.analyzedFiles).toHaveLength(1);
    expect(result.analyzedFiles[0]?.module.id).toBe('iam-server');
  });

  it('throws when overlapping modules share the same priority', () => {
    const rootDir = createTempWorkspace();
    writePolicy(rootDir, {
      modules: [
        {
          id: 'default',
          label: 'Default',
          class: 'zentral',
          owner: 'team-platform',
          reviewCadence: 'pro-pr',
          include: ['packages/**/*.ts'],
          exclude: ['**/*.test.ts'],
        },
        {
          id: 'iam-server',
          label: 'IAM Server',
          class: 'kritisch',
          owner: 'team-iam',
          reviewCadence: 'pro-pr',
          include: ['packages/iam-target/src/**/*.ts'],
          exclude: ['**/*.test.ts'],
        },
      ],
    });
    writeSourceFile(rootDir, 'priority.ts', 'export const value = 1;\n');

    expect(() => runComplexityGate({ rootDir, stepSummaryPath: null })).toThrow(
      /Complexity module overlap detected/
    );
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
        'iam-server:packages/iam-target/src/large.ts:fileLines': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'open',
          summary: 'Datei splitten',
        },
        'iam-server:packages/iam-target/src/large.ts:functionLines': {
          ticketId: 'QUAL-1',
          ticketSystem: 'backlog',
          status: 'open',
          summary: 'Datei splitten',
        },
        'iam-server:packages/iam-target/src/large.ts:cyclomaticComplexity': {
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

    expect(baseline.files['packages/iam-target/src/baseline.ts'].fileLines).toBe(3);
    expect(baseline.files['packages/iam-target/src/baseline.ts'].functionLines).toBe(3);
    expect(baseline.files['packages/iam-target/src/baseline.ts'].cyclomaticComplexity).toBe(1);
  });
});
