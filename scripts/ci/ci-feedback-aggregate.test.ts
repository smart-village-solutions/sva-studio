import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { appUnitJobs } from './affected-unit-plan.ts';
import { aggregateCiFeedback } from './ci-feedback-aggregate.ts';
import { buildCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import type { ChangedProjectPlan } from './changed-project-plan.ts';
import { selectRemainingUnitProjects, unitShardId } from './unit-shards.ts';

const directories: string[] = [];

const writeEvidence = (
  directory: string,
  shardId: string,
  projects: string[],
  options: {
    headSha?: string;
    baseSha?: string;
    status?: 'failed' | 'passed' | 'skipped';
    plan?: ChangedProjectPlan;
  } = {}
): string => {
  const evidence = buildCiFeedbackEvidence({
    gate: 'unit',
    role: shardId === 'unit-direct' ? 'fast-feedback' : 'complete',
    shardId,
    status: options.status ?? 'passed',
    baseSha: options.baseSha ?? 'base',
    headSha: options.headSha ?? 'head',
    scopeMode: 'affected',
    plan: options.plan ?? {
      mode: 'changed-first',
      reason: 'directly-changed-projects-first',
      directProjects: ['plugin-news'],
      remainingProjects: ['routing'],
      unmappedFiles: [],
    },
    phases: projects.map((project) => ({
      label: `${shardId}:${project}`,
      projects: [project],
      durationMs: 1,
    })),
    startedAt: new Date('2026-08-23T10:00:00Z'),
    finishedAt: new Date('2026-08-23T10:00:01Z'),
  });
  const filePath = path.join(directory, `unit-${shardId}-${Math.random()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(evidence));
  return filePath;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('ci-feedback-aggregate', () => {
  const createDirectory = (): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-feedback-aggregate-'));
    directories.push(directory);
    return directory;
  };

  it('accepts complete disjoint head-bound evidence', () => {
    const directory = createDirectory();
    writeEvidence(directory, 'unit-direct', ['plugin-news']);
    writeEvidence(directory, 'unit-remaining', ['routing']);

    expect(
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        expectedShards: ['unit-direct', 'unit-remaining'],
        evidenceDirectory: directory,
      })
    ).toMatchObject({
      shards: ['unit-direct', 'unit-remaining'],
      statuses: { 'unit-direct': 'passed', 'unit-remaining': 'passed' },
    });
  });

  const plan: ChangedProjectPlan = {
    mode: 'changed-first',
    reason: 'directly-changed-projects-first',
    directProjects: ['core'],
    remainingProjects: ['sva-studio-react', 'data', 'plugin-news', 'routing', 'tooling-testing'],
    unmappedFiles: [],
  };
  const expectedShards = [
    'unit-direct',
    ...[1, 2, 3, 4].map((index) => unitShardId({ index, count: 4 })),
  ];
  const writeShards = (directory: string, scope = plan): string[] => [
    writeEvidence(directory, 'unit-direct', scope.directProjects, { plan: scope }),
    ...[1, 2, 3, 4].map((index) => {
      const shard = { index, count: 4 };
      const projects = selectRemainingUnitProjects(scope.remainingProjects, shard);
      return writeEvidence(directory, unitShardId(shard), projects, {
        plan: scope,
        status: projects.length === 0 ? 'skipped' : 'passed',
      });
    }),
  ];
  const aggregateShards = (directory: string, expected = expectedShards) =>
    aggregateCiFeedback({
      gate: 'unit',
      headSha: 'head',
      expectedShards: expected,
      evidenceDirectory: directory,
    });

  it.each([
    plan,
    { ...plan, directProjects: [], remainingProjects: [] },
    {
      ...plan,
      mode: 'full-fallback' as const,
      directProjects: [],
      remainingProjects: [...plan.remainingProjects, 'core'],
    },
  ])('accepts a complete four-shard scope including empty shards: %j', (scope) => {
    const directory = createDirectory();
    writeShards(directory, scope);
    expect(aggregateShards(directory).shards).toEqual(expectedShards);
  });

  it.each([
    'missing',
    'failed',
    'stale-head',
    'stale-base',
    'different-plan',
    'missing-project',
    'wrong-shard',
    'duplicate',
    'unexpected',
    'invalid-status',
  ])('fails closed for %s in a four-shard run', (scenario) => {
    const directory = createDirectory();
    const paths = writeShards(directory);
    const target = paths[2];
    const evidence = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (scenario === 'missing') fs.rmSync(target);
    else if (scenario === 'duplicate')
      fs.copyFileSync(target, path.join(directory, 'unit-unit-duplicate.json'));
    else if (scenario === 'unexpected')
      writeEvidence(directory, 'unit-remaining-5-of-4', [], { plan });
    else {
      if (scenario === 'failed') evidence.status = 'failed';
      if (scenario === 'invalid-status') evidence.status = 'cancelled';
      if (scenario === 'stale-head') evidence.headSha = 'old';
      if (scenario === 'stale-base') evidence.baseSha = 'old';
      if (scenario === 'different-plan') evidence.plan.remainingProjects = [];
      if (scenario === 'missing-project') evidence.phases = [];
      if (scenario === 'wrong-shard') evidence.phases[0].projects = ['routing'];
      fs.writeFileSync(target, JSON.stringify(evidence));
    }
    expect(() => aggregateShards(directory)).toThrow();
  });

  it('rejects an expected list that silently drops a shard', () => {
    const directory = createDirectory();
    const paths = writeShards(directory);
    fs.rmSync(paths[4]);
    expect(() => aggregateShards(directory, expectedShards.slice(0, 4))).toThrow(
      /Shard-Konfiguration/u
    );
  });

  it('preserves sibling evidence when a failed shard is replaced in a partial rerun', () => {
    const directory = createDirectory();
    const paths = writeShards(directory);
    const target = paths[2];
    const original = fs.readFileSync(target, 'utf8');
    const siblingContents = paths
      .filter((file) => file !== target)
      .map((file) => fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(target, JSON.stringify({ ...JSON.parse(original), status: 'failed' }));
    expect(() => aggregateShards(directory)).toThrow(/fehlgeschlagen/u);
    fs.writeFileSync(target, original);
    expect(aggregateShards(directory).shards).toEqual(expectedShards);
    expect(
      paths.filter((file) => file !== target).map((file) => fs.readFileSync(file, 'utf8'))
    ).toEqual(siblingContents);
  });

  it.each([
    ['missing', () => undefined],
    [
      'stale',
      (directory: string) => writeEvidence(directory, 'unit-remaining', [], { headSha: 'old' }),
    ],
    [
      'failed',
      (directory: string) => writeEvidence(directory, 'unit-remaining', [], { status: 'failed' }),
    ],
    [
      'duplicate',
      (directory: string) => {
        writeEvidence(directory, 'unit-remaining', []);
        writeEvidence(directory, 'unit-remaining', []);
      },
    ],
  ])('fails closed for %s shard evidence', (_name, arrange) => {
    const directory = createDirectory();
    writeEvidence(directory, 'unit-direct', []);
    arrange(directory);

    expect(() =>
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        expectedShards: ['unit-direct', 'unit-remaining'],
        evidenceDirectory: directory,
      })
    ).toThrow();
  });

  it('fails closed when shard project scopes overlap', () => {
    const directory = createDirectory();
    writeEvidence(directory, 'unit-direct', ['plugin-news']);
    writeEvidence(directory, 'unit-remaining', ['plugin-news']);

    expect(() =>
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        expectedShards: ['unit-direct', 'unit-remaining'],
        evidenceDirectory: directory,
      })
    ).toThrow(/überlappen|unvollständig/u);
  });

  it('fails closed when a planned project has no executed phase', () => {
    const directory = createDirectory();
    writeEvidence(directory, 'unit-direct', ['plugin-news']);
    writeEvidence(directory, 'unit-remaining', []);
    const remainingFile = fs
      .readdirSync(directory)
      .find((fileName) => fileName.includes('unit-remaining'));
    if (!remainingFile) {
      throw new Error('test setup failed');
    }
    const filePath = path.join(directory, remainingFile);
    const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      plan: { remainingProjects: string[] };
    };
    evidence.plan.remainingProjects = ['routing'];
    fs.writeFileSync(filePath, JSON.stringify(evidence));

    expect(() =>
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        expectedShards: ['unit-direct', 'unit-remaining'],
        evidenceDirectory: directory,
      })
    ).toThrow(/unvollständig/u);
  });
});

describe('separate App Unit aggregation', () => {
  const arrange = (): { directory: string; expected: string[] } => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'app-unit-aggregate-'));
    directories.push(directory);
    const plan: ChangedProjectPlan = {
      mode: 'changed-first',
      reason: 'directly-changed-projects-first',
      directProjects: ['sva-studio-react'],
      remainingProjects: [],
      unmappedFiles: [],
    };
    const expected = [
      'unit-direct',
      'unit-remaining',
      ...appUnitJobs.map((job) => `unit-app-${job}`),
    ];
    for (const id of expected) {
      const selected = id.startsWith('unit-app-routes-');
      const file = writeEvidence(directory, id, selected ? ['sva-studio-react'] : [], {
        plan,
        status: selected ? 'passed' : 'skipped',
      });
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.appPlan = { mode: 'slices', reason: 'app-only-sliceable-change', slices: ['routes'] };
      if (selected)
        value.appManifest = {
          expectedFiles: ['1', '2', '3', '4'].map((n) => `routes-${n}.test.ts`),
          files: [`${id.slice('unit-app-'.length)}.test.ts`],
          tests: [],
        };
      value.phases = selected
        ? [
            {
              label: `unit:app:${id.slice('unit-app-'.length)}`,
              durationMs: 1,
              projects: ['sva-studio-react'],
            },
          ]
        : [];
      fs.writeFileSync(file, JSON.stringify(value));
    }
    return { directory, expected };
  };
  it('accepts every route partition and explicit nonselected slices', () => {
    const { directory, expected } = arrange();
    expect(
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        evidenceDirectory: directory,
        expectedShards: expected,
      }).shards
    ).toHaveLength(9);
  });
  it.each([
    'missing',
    'wrong-plan',
    'wrong-label',
    'wrong-base',
    'failed',
    'missing-file',
    'duplicate-file',
    'missing-manifest',
  ])('rejects %s app evidence', (kind) => {
    const { directory, expected } = arrange();
    const file = fs.readdirSync(directory).find((name) => name.includes('unit-app-routes-4'))!;
    const filePath = path.join(directory, file);
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (kind === 'missing') fs.rmSync(filePath);
    else {
      if (kind === 'wrong-plan') value.appPlan.slices = ['ui'];
      if (kind === 'wrong-label') value.phases[0].label = 'unit:app:routes-3';
      if (kind === 'wrong-base') value.baseSha = 'foreign';
      if (kind === 'failed') value.status = 'failed';
      if (kind === 'missing-file') value.appManifest.files = [];
      if (kind === 'duplicate-file') value.appManifest.files = ['routes-3.test.ts'];
      if (kind === 'missing-manifest') delete value.appManifest;
      fs.writeFileSync(filePath, JSON.stringify(value));
    }
    expect(() =>
      aggregateCiFeedback({
        gate: 'unit',
        headSha: 'head',
        evidenceDirectory: directory,
        expectedShards: expected,
      })
    ).toThrow();
  });
});

it('rejects evidence agreeing on a base that differs from the workflow source', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'foreign-base-'));
  directories.push(directory);
  writeEvidence(directory, 'unit-direct', ['plugin-news'], { baseSha: 'foreign' });
  writeEvidence(directory, 'unit-remaining', ['routing'], { baseSha: 'foreign' });
  expect(() =>
    aggregateCiFeedback({
      gate: 'unit',
      headSha: 'head',
      baseSha: 'base',
      expectedShards: ['unit-direct', 'unit-remaining'],
      evidenceDirectory: directory,
    })
  ).toThrow(/Base/);
});

describe('full Main App Unit aggregation', () => {
  const arrange = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'main-app-unit-'));
    directories.push(directory);
    const plan: ChangedProjectPlan = {
      mode: 'affected-fallback',
      reason: 'no-safe-direct-project-mapping',
      directProjects: [],
      remainingProjects: ['sva-studio-react', 'unit-only'],
      unmappedFiles: [],
    };
    const expectedShards = appUnitJobs.map((job) => `unit-app-${job}`);
    for (const job of appUnitJobs) {
      const file = writeEvidence(directory, `unit-app-${job}`, ['sva-studio-react'], {
        plan,
        baseSha: 'head',
      });
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.scopeMode = 'full';
      value.appPlan = { mode: 'aggregate', reason: 'app-in-remaining-scope', slices: [] };
      value.phases = [{ label: `unit:app:${job}`, projects: ['sva-studio-react'], durationMs: 1 }];
      value.appManifest = {
        expectedFiles: job.startsWith('routes-')
          ? ['routes-1', 'routes-2', 'routes-3', 'routes-4']
          : [job],
        files: [job],
        tests: [{ file: job, name: 'scenario', status: 'passed' }],
      };
      fs.writeFileSync(file, JSON.stringify(value));
    }
    return {
      gate: 'unit' as const,
      headSha: 'head',
      baseSha: 'head',
      evidenceDirectory: directory,
      expectedShards,
      appOnly: true,
    };
  };
  it('accepts seven full App manifests without fabricated direct or residual evidence', () => {
    expect(aggregateCiFeedback(arrange()).shards).toHaveLength(7);
  });
  it.each([
    'missing',
    'foreign-base',
    'foreign-head',
    'affected',
    'skip',
    'wrong-label',
    'missing-file',
    'overlap',
    'wrong-plan',
    'shared-skip',
    'duplicate',
    'unexpected',
  ])('rejects %s Main evidence', (kind) => {
    const options = arrange();
    const file = fs
      .readdirSync(options.evidenceDirectory)
      .find((name) => name.includes('unit-app-routes-4'));
    if (!file) throw new Error('App fixture is missing routes-4');
    const filePath = path.join(options.evidenceDirectory, file);
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (kind === 'missing') fs.rmSync(filePath);
    else if (kind === 'duplicate')
      fs.copyFileSync(
        filePath,
        path.join(options.evidenceDirectory, 'unit-unit-app-duplicate.json')
      );
    else if (kind === 'unexpected') writeEvidence(options.evidenceDirectory, 'unit-direct', []);
    else if (kind === 'shared-skip') {
      for (const name of fs.readdirSync(options.evidenceDirectory)) {
        const entryPath = path.join(options.evidenceDirectory, name);
        const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
        entry.appPlan = { mode: 'skip', reason: 'app-not-affected', slices: [] };
        fs.writeFileSync(entryPath, JSON.stringify(entry));
      }
    } else {
      if (kind === 'foreign-base') value.baseSha = 'foreign';
      if (kind === 'foreign-head') value.headSha = 'foreign';
      if (kind === 'affected') value.scopeMode = 'affected';
      if (kind === 'skip') {
        value.status = 'skipped';
        value.phases = [];
      }
      if (kind === 'wrong-label') value.phases[0].label = 'unit:app:ui';
      if (kind === 'missing-file') value.appManifest.files = [];
      if (kind === 'overlap') value.appManifest.files = ['routes-3'];
      if (kind === 'wrong-plan') value.plan.remainingProjects = ['unit-only'];
      fs.writeFileSync(filePath, JSON.stringify(value));
    }
    expect(() => aggregateCiFeedback(options)).toThrow();
  });
  it('does not allow the expected list to remove a Main App slot', () => {
    const options = arrange();
    options.expectedShards.pop();
    expect(() => aggregateCiFeedback(options)).toThrow();
  });
  it('requires the workflow base to equal its head', () => {
    expect(() => aggregateCiFeedback({ ...arrange(), baseSha: 'other' })).toThrow();
  });
});
