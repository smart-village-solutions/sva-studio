import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import {
  writeCoverageShardEvidence,
  type CoveragePartitionEvidence,
} from './coverage-shard-evidence.ts';
import {
  mergeProjectCoverage,
  validateDownloadedCoverage,
} from './validate-downloaded-coverage.ts';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const directories: string[] = [];

afterEach(() => {
  vi.resetAllMocks();
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('validate-downloaded-coverage', () => {
  it('discovers source-colocated tests when validating merged coverage and rejects missing files', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'downloaded-coverage-'));
    directories.push(rootDir);
    const project = 'plugin-waste-management';
    const projectRoot = `packages/${project}`;
    const files = ['tests/plugin.test.ts', 'src/email-monitoring.page.test.tsx'].map((file) =>
      path.join(rootDir, projectRoot, file)
    );
    const partitionDir = path.join(rootDir, 'coverage-partition-waste-1');
    fs.mkdirSync(partitionDir);
    fs.writeFileSync(path.join(partitionDir, 'report.blob.json'), '{}');
    const resultPath = path.join(partitionDir, 'test-results.json');
    const writeResults = (names: string[]) =>
      fs.writeFileSync(
        resultPath,
        JSON.stringify({
          success: true,
          numFailedTests: 0,
          numFailedTestSuites: 0,
          testResults: names.map((name) => ({ name, assertionResults: [] })),
        })
      );
    writeResults(files);
    const entry: CoveragePartitionEvidence = {
      schemaVersion: 1,
      partition: 'waste-1',
      baseSha: 'base',
      headSha: 'head',
      phases: [],
      timing: { startedAt: '2026-11-11T12:00:00Z', finishedAt: '2026-11-11T12:00:01Z' },
      plan: {
        changedFiles: [],
        affectedProjects: [project],
        projectRoots: [{ name: project, root: projectRoot }],
        changedProjectPlan: {
          mode: 'changed-first',
          reason: 'directly-changed-projects-first',
          directProjects: [project],
          remainingProjects: [],
          unmappedFiles: [],
        },
      },
      reports: [
        { project, kind: 'blob', path: 'report.blob.json', sha256: 'unused' },
        { project, kind: 'tests', path: 'test-results.json', sha256: 'unused' },
      ],
    };
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      if (args?.includes('list')) {
        const discovered = args.includes('tests') ? files.slice(0, 1) : files;
        return JSON.stringify(discovered.map((file) => ({ file })));
      }
      return '';
    });

    expect(() => mergeProjectCoverage(project, [entry], rootDir, rootDir)).not.toThrow();
    writeResults(files.slice(0, 1));
    expect(() => mergeProjectCoverage(project, [entry], rootDir, rootDir)).toThrow(/Testmenge/u);
  });

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

    fs.mkdirSync(path.join(rootDir, 'duplicate'));
    fs.copyFileSync(
      path.join(rootDir, 'artifacts/ci-feedback/coverage-coverage-complete.json'),
      path.join(rootDir, 'duplicate/coverage-coverage-complete.json')
    );
    expect(() => validateDownloadedCoverage(rootDir, 'head')).toThrow(/mehrfach/u);
  });
});
