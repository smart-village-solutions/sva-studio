import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const createdDirs: string[] = [];
const testDir = path.dirname(fileURLToPath(import.meta.url));

type RunSonarNewCodeGate = (options: {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  targetPct?: number;
}) => {
  passed: boolean;
  targetPct: number;
  coveragePct: number;
  coveredUnits: number;
  missedUnits: number;
  coveredLines: number;
  missedLines: number;
  coveredBranches: number;
  missedBranches: number;
  consideredFiles: number;
  ignoredFiles: number;
  uncoveredFiles: Array<{
    path: string;
    covered: number;
    missed: number;
    coveredBranches: number;
    missedBranches: number;
  }>;
};

async function loadRunSonarNewCodeGate(): Promise<RunSonarNewCodeGate> {
  const moduleUrl = pathToFileURL(
    path.resolve(testDir, '../../../scripts/ci/sonar-new-code-gate.ts')
  ).href;
  const module = (await import(moduleUrl)) as {
    runSonarNewCodeGate: RunSonarNewCodeGate;
  };
  return module.runSonarNewCodeGate;
}

function createTempWorkspace(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-new-code-gate-'));
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
      'server-runtime': {
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

function writeSonarProjectProperties(rootDir: string, coverageExclusions: readonly string[] = []): void {
  const contents =
    coverageExclusions.length > 0 ? `sonar.coverage.exclusions=${coverageExclusions.join(',')}\n` : '\n';
  fs.writeFileSync(path.join(rootDir, 'sonar-project.properties'), contents);
}

function writeSourceFile(rootDir: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function writeLcov(
  rootDir: string,
  projectPath: string,
  sourcePath: string,
  entries: {
    da?: Array<[number, number]>;
    brda?: Array<[number, number | '-', number | '-', number | '-']>;
  }
): void {
  const coverageDir = path.join(rootDir, projectPath, 'coverage');
  fs.mkdirSync(coverageDir, { recursive: true });
  const record = [
    'TN:',
    `SF:${sourcePath}`,
    ...(entries.da ?? []).map(([line, hits]) => `DA:${line},${hits}`),
    ...(entries.brda ?? []).map(([line, block, branch, taken]) => `BRDA:${line},${block},${branch},${taken}`),
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

describe('sonar new code gate', () => {
  it('fails when changed branches are only partially covered', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export function value(flag: boolean): number {\n  return flag ? 1 : 0;\n}\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export function value(flag: boolean): number {\n  return flag ? 2 : 0;\n}\n');
    writeLcov(rootDir, 'packages/server-runtime', 'src/index.ts', {
      da: [[2, 1]],
      brda: [
        [2, 0, 0, 1],
        [2, 0, 1, 0],
      ],
    });
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(false);
    expect(result.coveredLines).toBe(1);
    expect(result.coveredBranches).toBe(1);
    expect(result.missedBranches).toBe(1);
    expect(result.coveragePct).toBe(66.67);
  }, 20_000);

  it('ignores files excluded from sonar coverage', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir, {
      perProjectFloors: {
        'sva-studio-react': {
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        },
      },
    });
    writeSonarProjectProperties(rootDir, ['apps/sva-studio-react/src/routes/__debug/phase1-test/**']);
    writeSourceFile(
      rootDir,
      'apps/sva-studio-react/src/routes/__debug/phase1-test/-index.ts',
      'export const route = () => new Response("debug");\n'
    );
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(
      rootDir,
      'apps/sva-studio-react/src/routes/__debug/phase1-test/-index.ts',
      'export const route = () => new Response("debug-2");\n'
    );
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.consideredFiles).toBe(0);
    expect(result.ignoredFiles).toBe(0);
  });

  it('passes when changed lines and branches are fully covered', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export function value(flag: boolean): number {\n  return flag ? 1 : 0;\n}\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export function value(flag: boolean): number {\n  return flag ? 2 : 0;\n}\n');
    writeLcov(rootDir, 'packages/server-runtime', 'src/index.ts', {
      da: [[2, 1]],
      brda: [
        [2, 0, 0, 1],
        [2, 0, 1, 1],
      ],
    });
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.coveragePct).toBe(100);
    expect(result.missedUnits).toBe(0);
  }, 20_000);

  it('does not advance changed line numbers for no-newline diff metadata', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export const one = 1;');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export const one = 2;\nexport const two = 2;\n');
    writeLcov(rootDir, 'packages/server-runtime', 'src/index.ts', {
      da: [
        [1, 0],
        [2, 1],
      ],
    });
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(false);
    expect(result.coveredLines).toBe(1);
    expect(result.missedLines).toBe(1);
    expect(result.coveragePct).toBe(50);
  }, 20_000);

  it('ignores type-only changes without lcov data', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir);
    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export type Demo = {\n  readonly value: string;\n};\n');
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(rootDir, 'packages/server-runtime/src/index.ts', 'export type Demo = {\n  readonly value: string;\n  readonly status: string;\n};\n');
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.consideredFiles).toBe(0);
    expect(result.ignoredFiles).toBe(1);
  });

  it('ignores generated route tree artifacts without lcov data', async () => {
    const runSonarNewCodeGate = await loadRunSonarNewCodeGate();
    const rootDir = createTempWorkspace();
    initGitRepo(rootDir);
    writePolicy(rootDir, {
      perProjectFloors: {
        'sva-studio-react': {
          lines: 0,
          statements: 0,
          functions: 0,
          branches: 0,
        },
      },
    });
    writeSourceFile(
      rootDir,
      'apps/sva-studio-react/src/routeTree.gen.ts',
      `/* eslint-disable */\n\n// This file was automatically generated by TanStack Router.\n// You should NOT make any changes in this file as it will be overwritten.\n\nexport const routeTree = {};\n`
    );
    commitAll(rootDir, 'base');
    runGit(rootDir, ['checkout', '-b', 'feature/test']);

    writeSourceFile(
      rootDir,
      'apps/sva-studio-react/src/routeTree.gen.ts',
      `/* eslint-disable */\n\n// This file was automatically generated by TanStack Router.\n// You should NOT make any changes in this file as it will be overwritten.\n\nexport const routeTree = { root: true };\n`
    );
    commitAll(rootDir, 'change');

    const result = runSonarNewCodeGate({
      rootDir,
      baseRef: 'main',
      headRef: 'HEAD',
      targetPct: 85,
    });

    expect(result.passed).toBe(true);
    expect(result.consideredFiles).toBe(0);
    expect(result.ignoredFiles).toBe(1);
  });
});
