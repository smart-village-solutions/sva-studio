import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

describe('runLocalDevServerRunner', () => {
  it('handles a child spawn error without an unhandled error event', () => {
    const tempDir = mkdtempSync(resolve(process.cwd(), '.local-dev-runner-test-'));
    const logFile = resolve(tempDir, 'runner.log');
    const stateFile = resolve(tempDir, 'state.json');
    const runnerUrl = pathToFileURL(resolve(process.cwd(), 'scripts/ops/runtime/local-dev-server-runner.ts')).href;

    try {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `const { runLocalDevServerRunner } = await import(process.argv[1]);
           await runLocalDevServerRunner(['--profile=test', '--log-file=' + process.argv[2], '--state-file=' + process.argv[3]]).catch(() => {});`,
          runnerUrl,
          logFile,
          stateFile,
        ],
        { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PATH: '' } },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("Unhandled 'error' event");
      expect(readFileSync(logFile, 'utf8')).toContain('spawn pnpm ENOENT');
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
