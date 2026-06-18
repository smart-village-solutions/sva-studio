import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readLocalStateFile,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand,
} from './local-runtime.ts';

let tempDir: string | null = null;

const createTempDir = () => {
  tempDir = mkdtempSync(join(tmpdir(), 'runtime-local-runtime-test-'));
  return tempDir;
};

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe('readLocalStateFile', () => {
  it('returns null for invalid state payloads', () => {
    const tempDir = createTempDir();
    mkdirSync(tempDir, { recursive: true });
    const stateFile = resolve(tempDir, 'invalid.json');
    writeFileSync(stateFile, '{"profile":"local-keycloak"}\n', 'utf8');

    expect(readLocalStateFile(stateFile)).toBeNull();
  });

  it('parses valid local state payloads', () => {
    const tempDir = createTempDir();
    mkdirSync(tempDir, { recursive: true });
    const stateFile = resolve(tempDir, 'valid.json');
    writeFileSync(
      stateFile,
      `${JSON.stringify({
        logFile: '/tmp/local-keycloak.log',
        pid: 12345,
        profile: 'local-keycloak',
        startedAt: '2026-06-18T09:00:00.000Z',
      })}\n`,
      'utf8',
    );

    expect(readLocalStateFile(stateFile)).toMatchObject({
      pid: 12345,
      profile: 'local-keycloak',
    });
  });
});

describe('local runtime helpers', () => {
  it('checks registry drift only before up/update commands', () => {
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('up')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('update')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('migrate')).toBe(false);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('reconcile')).toBe(false);
  });
});
