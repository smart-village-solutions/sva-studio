import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  validateCoverageShardEvidence,
  validateCoveragePartitions,
  writeCoveragePartitionEvidence,
  writeCoverageShardEvidence,
} from './coverage-shard-evidence.ts';

const directories: string[] = [];

const createWorkspace = (): string => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-shard-evidence-'));
  directories.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'packages/example/coverage'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tooling/testing'), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, 'tooling/testing/coverage-policy.json'),
    '{"exemptProjects":[]}'
  );
  fs.writeFileSync(path.join(rootDir, 'packages/example/coverage/coverage-summary.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'packages/example/coverage/lcov.info'), 'TN:\n');
  return rootDir;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('coverage-shard-evidence', () => {
  it('writes and validates a versioned head-bound project shard', () => {
    const rootDir = createWorkspace();
    writeCoverageShardEvidence({
      rootDir,
      project: 'example',
      phase: 'direct',
      headSha: 'head',
      projectRoots: [{ name: 'example', root: 'packages/example' }],
    });

    expect(
      validateCoverageShardEvidence({ rootDir, headSha: 'head', expectedProjects: ['example'] })
    ).toMatchObject([
      {
        schemaVersion: 1,
        shardId: 'direct-example',
        projects: ['example'],
        reportStatus: 'complete',
        reports: [{ kind: 'summary' }, { kind: 'lcov' }],
      },
    ]);
  });

  it('represents a policy-exempt target without inventing coverage reports', () => {
    const rootDir = createWorkspace();
    fs.rmSync(path.join(rootDir, 'packages/example/coverage'), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'tooling/testing/coverage-policy.json'),
      '{"exemptProjects":["example"]}'
    );
    writeCoverageShardEvidence({
      rootDir,
      project: 'example',
      phase: 'direct',
      headSha: 'head',
      projectRoots: [{ name: 'example', root: 'packages/example' }],
    });

    expect(
      validateCoverageShardEvidence({ rootDir, headSha: 'head', expectedProjects: ['example'] })
    ).toMatchObject([{ reportStatus: 'policy-exempt', reports: [] }]);
  });

  it('fails closed for missing reports', () => {
    const rootDir = createWorkspace();
    fs.rmSync(path.join(rootDir, 'packages/example/coverage/lcov.info'));

    expect(() =>
      writeCoverageShardEvidence({
        rootDir,
        project: 'example',
        phase: 'direct',
        headSha: 'head',
        projectRoots: [{ name: 'example', root: 'packages/example' }],
      })
    ).toThrow(/fehlt/u);
  });

  it.each([
    ['missing shard', () => undefined],
    [
      'stale head',
      (rootDir: string) => {
        writeCoverageShardEvidence({
          rootDir,
          project: 'example',
          phase: 'direct',
          headSha: 'old',
          projectRoots: [{ name: 'example', root: 'packages/example' }],
        });
      },
    ],
    [
      'changed report',
      (rootDir: string) => {
        writeCoverageShardEvidence({
          rootDir,
          project: 'example',
          phase: 'direct',
          headSha: 'head',
          projectRoots: [{ name: 'example', root: 'packages/example' }],
        });
        fs.appendFileSync(
          path.join(rootDir, 'packages/example/coverage/lcov.info'),
          'SF:changed\n'
        );
      },
    ],
  ])('fails closed for %s', (_name, arrange) => {
    const rootDir = createWorkspace();
    arrange(rootDir);
    expect(() =>
      validateCoverageShardEvidence({ rootDir, headSha: 'head', expectedProjects: ['example'] })
    ).toThrow();
  });
});

describe('mandatory distributed coverage reports', () => {
  const arrange = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-partitions-'));
    directories.push(directory);
    const plan = {
      changedFiles: [],
      affectedProjects: ['example'],
      projectRoots: [{ name: 'example', root: 'packages/example' }],
      changedProjectPlan: {
        mode: 'changed-first' as const,
        reason: 'test',
        directProjects: ['example'],
        remainingProjects: [],
        unmappedFiles: [],
      },
    };
    for (const partition of ['direct-1', 'remaining-1']) {
      const root = path.join(directory, `coverage-partition-${partition}`);
      fs.mkdirSync(path.join(root, 'packages/example/coverage'), { recursive: true });
      for (const file of ['coverage-summary.json', 'lcov.info', 'test-results.json'])
        fs.writeFileSync(path.join(root, 'packages/example/coverage', file), '{}');
      writeCoveragePartitionEvidence(
        {
          partition,
          baseSha: 'base',
          headSha: 'head',
          plan,
          phases:
            partition === 'direct-1'
              ? [{ label: 'test', durationMs: 1, projects: ['example'] }]
              : [],
          timing: { startedAt: '2026-11-08T10:00:00Z', finishedAt: '2026-11-08T10:00:01Z' },
        },
        root
      );
    }
    return directory;
  };
  it('accepts complete reports and explicit empty partitions', () => {
    expect(
      validateCoveragePartitions({
        directory: arrange(),
        baseSha: 'base',
        headSha: 'head',
        expected: ['direct-1', 'remaining-1'],
      })
    ).toHaveLength(2);
  });
  it.each(['missing', 'modified', 'wrong-head', 'wrong-base', 'duplicate', 'plan-drift'])(
    'rejects %s reports',
    (kind) => {
      const directory = arrange();
      const file = path.join(
        directory,
        'coverage-partition-direct-1/artifacts/ci-feedback/coverage-partitions/direct-1.json'
      );
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (kind === 'missing') fs.rmSync(file);
      else if (kind === 'modified')
        fs.writeFileSync(
          path.join(directory, 'coverage-partition-direct-1/packages/example/coverage/lcov.info'),
          'modified'
        );
      else {
        if (kind === 'wrong-head') value.headSha = 'foreign';
        if (kind === 'wrong-base') value.baseSha = 'foreign';
        if (kind === 'duplicate') value.reports.push(value.reports[0]);
        if (kind === 'plan-drift') value.plan.changedFiles = ['other'];
        fs.writeFileSync(file, JSON.stringify(value));
      }
      expect(() =>
        validateCoveragePartitions({
          directory,
          baseSha: 'base',
          headSha: 'head',
          expected: ['direct-1', 'remaining-1'],
        })
      ).toThrow();
    }
  );
});

it('merges actual instrumented Vitest blobs with identical coverage counters', () => {
  // Real subprocess contract: summing percentages would fail this overlap case.
  const root = fs.mkdtempSync(path.join(process.cwd(), '.nx', 'coverage-merge-contract-'));
  directories.push(root);
  fs.writeFileSync(
    path.join(root, 'source.ts'),
    'export const classify = (n: number) => n > 0 ? "positive" : "other";'
  );
  for (const [name, value, expected] of [
    ['positive', 1, 'positive'],
    ['negative', -1, 'other'],
  ] as const) {
    fs.writeFileSync(
      path.join(root, `${name}.test.ts`),
      `import { it, expect } from 'vitest'; import { classify } from './source'; it('${name}',()=>expect(classify(${value})).toBe('${expected}'));`
    );
  }
  fs.writeFileSync(
    path.join(root, 'vitest.config.ts'),
    `export default { test: { include: ['*.test.ts'], maxWorkers: 1, coverage: { provider: 'v8', include: ['source.ts'], reporter: ['json','json-summary','lcov'] } } };`
  );
  const bin = path.resolve('node_modules/vitest/vitest.mjs');
  const run = (args: string[]) =>
    execFileSync(process.execPath, [bin, ...args], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '' },
    });
  run(['run', '--coverage', '--coverage.reportsDirectory=baseline']);
  const original = JSON.parse(
    fs.readFileSync(path.join(root, 'baseline/coverage-final.json'), 'utf8')
  );
  expect(Object.keys(original)).toHaveLength(1);
  fs.mkdirSync(path.join(root, 'blobs'));
  for (let index = 1; index <= 2; index++)
    run([
      'run',
      '--coverage',
      `--shard=${index}/2`,
      `--coverage.reportsDirectory=part-${index}`,
      '--reporter=blob',
      `--outputFile.blob=blobs/${index}.json`,
    ]);
  run(['--mergeReports=blobs', '--coverage', '--coverage.reportsDirectory=merged']);
  const merged = JSON.parse(fs.readFileSync(path.join(root, 'merged/coverage-final.json'), 'utf8'));
  expect(merged).toEqual(original);
  expect(fs.readFileSync(path.join(root, 'merged/lcov.info'), 'utf8')).toEqual(
    fs.readFileSync(path.join(root, 'baseline/lcov.info'), 'utf8')
  );
}, 30000);
