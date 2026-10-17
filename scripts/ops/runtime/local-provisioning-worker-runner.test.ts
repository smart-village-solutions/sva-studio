import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLocalProvisioningWorkerChildEnv,
  clearLocalWorkerStateIfOwned,
  parseLocalProvisioningWorkerRunnerArgs,
} from './local-provisioning-worker-runner.ts';

describe('parseLocalProvisioningWorkerRunnerArgs', () => {
  it('parses the required runner args', () => {
    expect(
      parseLocalProvisioningWorkerRunnerArgs([
        '--profile=local-keycloak',
        '--log-file=/tmp/local-keycloak.worker.log',
        '--state-file=/tmp/local-worker-state.json',
      ]),
    ).toEqual({
      logFile: '/tmp/local-keycloak.worker.log',
      profile: 'local-keycloak',
      stateFile: '/tmp/local-worker-state.json',
    });
  });

  it('rejects incomplete arg sets', () => {
    expect(() => parseLocalProvisioningWorkerRunnerArgs(['--profile=local-keycloak'])).toThrow(/Usage:/u);
  });
});

describe('clearLocalWorkerStateIfOwned', () => {
  it('removes the state file when the pid matches', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'local-provisioning-worker-runner-'));
    const stateFile = resolve(tempDir, 'local-worker-state.json');
    writeFileSync(stateFile, JSON.stringify({ pid: 1234 }), 'utf8');

    clearLocalWorkerStateIfOwned(stateFile, 1234);

    expect(() => readFileSync(stateFile, 'utf8')).toThrow();
  });

  it('keeps the state file when owned by another pid', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'local-provisioning-worker-runner-'));
    const stateFile = resolve(tempDir, 'local-worker-state.json');
    writeFileSync(stateFile, JSON.stringify({ pid: 1234 }), 'utf8');

    clearLocalWorkerStateIfOwned(stateFile, 5678);

    expect(JSON.parse(readFileSync(stateFile, 'utf8'))).toEqual({ pid: 1234 });
  });
});

describe('buildLocalProvisioningWorkerChildEnv', () => {
  it('pins the worker to runs created after the current startup', () => {
    const env = buildLocalProvisioningWorkerChildEnv(
      {
        PATH: process.env.PATH,
      },
      '2026-05-27T12:00:00.000Z',
    );

    expect(env.SVA_KEYCLOAK_PROVISIONER_CLAIM_NOT_BEFORE).toBe('2026-05-27T12:00:00.000Z');
    expect(env.PATH).toBe(process.env.PATH);
  });
});

describe('runLocalProvisioningWorkerRunner', () => {
  it('handles a child spawn error without an unhandled error event', () => {
    const tempDir = mkdtempSync(resolve(process.cwd(), '.local-worker-runner-test-'));
    const logFile = resolve(tempDir, 'runner.log');
    const stateFile = resolve(tempDir, 'state.json');
    const runnerUrl = pathToFileURL(resolve(process.cwd(), 'scripts/ops/runtime/local-provisioning-worker-runner.ts')).href;

    try {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `process.execPath = '/nonexistent/runner-node';
           const { runLocalProvisioningWorkerRunner } = await import(process.argv[1]);
           await runLocalProvisioningWorkerRunner(['--profile=test', '--log-file=' + process.argv[2], '--state-file=' + process.argv[3]]).catch(() => {});`,
          runnerUrl,
          logFile,
          stateFile,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("Unhandled 'error' event");
      expect(readFileSync(logFile, 'utf8')).toContain('spawn /nonexistent/runner-node ENOENT');
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
