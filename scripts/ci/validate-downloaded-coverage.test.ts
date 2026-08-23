import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { writeCoverageShardEvidence } from './coverage-shard-evidence.ts';
import { validateDownloadedCoverage } from './validate-downloaded-coverage.ts';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('validate-downloaded-coverage', () => {
  it('binds complete coverage reports and shard evidence to the aggregate plan and head', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'downloaded-coverage-'));
    directories.push(rootDir);
    fs.mkdirSync(path.join(rootDir, 'packages/example/coverage'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'artifacts/ci-feedback'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'tooling/testing'), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'tooling/testing/coverage-policy.json'),
      '{"exemptProjects":[]}'
    );
    fs.writeFileSync(path.join(rootDir, 'packages/example/coverage/coverage-summary.json'), '{}');
    fs.writeFileSync(path.join(rootDir, 'packages/example/coverage/lcov.info'), 'TN:\n');
    writeCoverageShardEvidence({
      rootDir,
      project: 'example',
      phase: 'direct',
      headSha: 'head',
      projectRoots: [{ name: 'example', root: 'packages/example' }],
    });
    const feedback = buildCiFeedbackEvidence({
      gate: 'coverage',
      role: 'complete',
      shardId: 'coverage-complete',
      status: 'passed',
      baseSha: 'base',
      headSha: 'head',
      scopeMode: 'affected',
      plan: {
        mode: 'changed-first',
        reason: 'directly-changed-projects-first',
        directProjects: ['example'],
        remainingProjects: [],
        unmappedFiles: [],
      },
      phases: [],
      startedAt: new Date('2026-08-23T10:00:00Z'),
      finishedAt: new Date('2026-08-23T10:00:01Z'),
    });
    fs.writeFileSync(
      path.join(rootDir, 'artifacts/ci-feedback/coverage-coverage-complete.json'),
      JSON.stringify(feedback)
    );

    expect(() => validateDownloadedCoverage(rootDir, 'head')).not.toThrow();
    expect(() => validateDownloadedCoverage(rootDir, 'stale')).toThrow(/ungültig/u);
  });
});
