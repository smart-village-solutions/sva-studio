import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { clearLocalStateIfOwned, parseLocalDevServerRunnerArgs } from './local-dev-server-runner.ts';

describe('parseLocalDevServerRunnerArgs', () => {
  it('parses the required runner args', () => {
    expect(
      parseLocalDevServerRunnerArgs([
        '--profile=local-keycloak',
        '--log-file=/tmp/local-keycloak.log',
        '--state-file=/tmp/local-app-state.json',
      ])
    ).toEqual({
      logFile: '/tmp/local-keycloak.log',
      profile: 'local-keycloak',
      stateFile: '/tmp/local-app-state.json',
    });
  });

  it('rejects incomplete arg sets', () => {
    expect(() => parseLocalDevServerRunnerArgs(['--profile=local-keycloak'])).toThrow(/Usage:/u);
  });
});

describe('clearLocalStateIfOwned', () => {
  it('removes the state file when the pid matches', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'local-dev-server-runner-'));
    const stateFile = resolve(tempDir, 'local-app-state.json');
    writeFileSync(stateFile, JSON.stringify({ pid: 1234 }), 'utf8');

    clearLocalStateIfOwned(stateFile, 1234);

    expect(() => readFileSync(stateFile, 'utf8')).toThrow();
  });

  it('keeps the state file when owned by another pid', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'local-dev-server-runner-'));
    const stateFile = resolve(tempDir, 'local-app-state.json');
    writeFileSync(stateFile, JSON.stringify({ pid: 1234 }), 'utf8');

    clearLocalStateIfOwned(stateFile, 5678);

    expect(JSON.parse(readFileSync(stateFile, 'utf8'))).toEqual({ pid: 1234 });
  });
});
