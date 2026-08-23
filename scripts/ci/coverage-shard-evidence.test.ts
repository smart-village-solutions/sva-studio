import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  validateCoverageShardEvidence,
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
