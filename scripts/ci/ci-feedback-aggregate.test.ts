import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { aggregateCiFeedback } from './ci-feedback-aggregate.ts';
import { buildCiFeedbackEvidence } from './ci-feedback-evidence.ts';

const directories: string[] = [];

const writeEvidence = (
  directory: string,
  shardId: string,
  projects: string[],
  options: { headSha?: string; status?: 'failed' | 'passed' | 'skipped' } = {}
): void => {
  const evidence = buildCiFeedbackEvidence({
    gate: 'unit',
    role: shardId === 'unit-direct' ? 'fast-feedback' : 'complete',
    shardId,
    status: options.status ?? 'passed',
    baseSha: 'base',
    headSha: options.headSha ?? 'head',
    scopeMode: 'affected',
    plan: {
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
  fs.writeFileSync(
    path.join(directory, `unit-${shardId}-${Math.random()}.json`),
    JSON.stringify(evidence)
  );
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
