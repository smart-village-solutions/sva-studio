import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
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
