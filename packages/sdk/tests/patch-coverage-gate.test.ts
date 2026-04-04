import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const createdDirs: string[] = [];
const testDir = path.dirname(fileURLToPath(import.meta.url));

type RunPatchCoverageGate = (options: {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}) => {
  passed: boolean;
  targetPct: number;
  coveragePct: number;
  coveredLines: number;
  missedLines: number;
  consideredFiles: number;
  ignoredFiles: number;
  uncoveredFiles: Array<{
    path: string;
    covered: number;
    missed: number;
  }>;
};

async function loadRunPatchCoverageGate(): Promise<RunPatchCoverageGate> {
  const moduleUrl = pathToFileURL(
    path.resolve(testDir, '../../../scripts/ci/patch-coverage-gate.ts')
  ).href;
  const module = (await import(moduleUrl)) as {
    runPatchCoverageGate: RunPatchCoverageGate;
  };
  return module.runPatchCoverageGate;
}

function createTempWorkspace(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-coverage-gate-'));
  createdDirs.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'packages'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tooling/testing'), { recursive: true });
  return rootDir;
}

function runGit(rootDir: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
}

function initGitRepo(rootDir: string): void {
  runGit(rootDir, ['init', '-b', 'main']);
  runGit(rootDir, ['config', 'user.name', 'Codex']);
  runGit(rootDir, ['config', 'user.email', 'codex@example.com']);
}

function commitAll(rootDir: string, message: string): void {
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '-m', message]);
}

function writePolicy(rootDir: string, overrides: Record<string, unknown> = {}): void {
  const policy = {
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
    criticalProjects: {},
    ...overrides,
  };

  fs.writeFileSync(
    path.join(rootDir, 'tooling/testing/coverage-policy.json'),
    JSON.stringify(policy, null, 2)
  );
}

function writeSourceFile(rootDir: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function writeLcov(rootDir: string, projectPath: string, sourcePath: string, daEntries: Array<[number, number]>): void {
  const coverageDir = path.join(rootDir, projectPath, 'coverage');
  fs.mkdirSync(coverageDir, { recursive: true });
  const record = [
    'TN:',
    `SF:${sourcePath}`,
    ...daEntries.map(([line, hits]) => `DA:${line},${hits}`),
    'LF:1',
    `LH:${daEntries.filter(([, hits]) => hits > 0).length}`,
    'end_of_record',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(coverageDir, 'lcov.info'), record);
}

afterEach(() => {
  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('patch coverage gate', () => {
  it('ignores coverage-exempt projects when computing patch coverage', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir, {
      exemptProjects: ['data'],
      perProjectFloors: {
        sdk: {
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        },
        data: {
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        },
      },
    });
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function sdkValue(): number {\n  return 1;\n}\n');
    writeSourceFile(rootDir, 'packages/data/src/query.ts', 'export function dataValue(): number {\n  return 1;\n}\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function sdkValue(): number {\n  return 2;\n}\n');
    writeSourceFile(rootDir, 'packages/data/src/query.ts', 'export function dataValue(): number {\n  return 2;\n}\n');
    writeLcov(rootDir, 'packages/sdk', 'src/index.ts', [[2, 1]]);
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.coveragePct).toBe(100);
    expect(result.consideredFiles).toBe(1);
  }, 20_000);

  it('fails when changed executable lines in a covered project have no lcov record', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export const value = 1;\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export const value = 2;\n');
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(false);
    expect(result.coveragePct).toBe(0);
    expect(result.missedLines).toBe(1);
    expect(result.uncoveredFiles[0]?.path).toBe('packages/sdk/src/index.ts');
  });

  it('maps lcov js source entries back to changed TypeScript files', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function value(): number {\n  return 1;\n}\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function value(): number {\n  return 2;\n}\n');
    writeLcov(rootDir, 'packages/sdk', 'src/index.js', [[2, 1]]);
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.coveragePct).toBe(100);
    expect(result.coveredLines).toBe(1);
    expect(result.missedLines).toBe(0);
  });

  it('prefers TypeScript sources over colocated js artifacts in lcov records', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function value(): number {\n  return 1;\n}\n');
    writeSourceFile(rootDir, 'packages/sdk/src/index.js', 'export function value() {\n  return 1;\n}\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export function value(): number {\n  return 2;\n}\n');
    writeLcov(rootDir, 'packages/sdk', 'src/index.js', [[2, 1]]);
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.coveragePct).toBe(100);
    expect(result.uncoveredFiles).toEqual([]);
  });

  it('ignores files that only contain type declarations or re-exports without lcov data', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', 'export type Demo = {\n  readonly value: string;\n};\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(
      rootDir,
      'packages/sdk/src/index.ts',
      "export * from './types';\n"
    );
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.consideredFiles).toBe(0);
    expect(result.ignoredFiles).toBe(1);
  });

  it('ignores multiline type unions and export barrels without lcov data', async () => {
    const runPatchCoverageGate = await loadRunPatchCoverageGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(
      rootDir,
      'packages/sdk/src/contracts.ts',
      "import type { ExternalId } from './shared';\n\nexport type Status =\n  | 'active'\n  | 'inactive';\n\nexport type DemoPayload = {\n  readonly id: ExternalId;\n  readonly status: Status;\n};\n"
    );
    writeSourceFile(rootDir, 'packages/sdk/src/index.ts', "export type { DemoPayload, Status } from './contracts';\n");
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(
      rootDir,
      'packages/sdk/src/contracts.ts',
      "import type { ExternalId } from './shared';\n\nexport type Status =\n  | 'active'\n  | 'inactive'\n  | 'pending';\n\nexport type DemoPayload = {\n  readonly id: ExternalId;\n  readonly status: Status;\n};\n"
    );
    writeSourceFile(
      rootDir,
      'packages/sdk/src/index.ts',
      "export {\n  value,\n} from './runtime';\nexport type {\n  DemoPayload,\n  Status,\n} from './contracts';\n"
    );
    commitAll(rootDir, 'change');

    const result = runPatchCoverageGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.consideredFiles).toBe(0);
    expect(result.ignoredFiles).toBe(2);
  });
});
