import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readLocalStateFile,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker,
} from './local-runtime.ts';

const tempDir = resolve(process.cwd(), 'tmp', 'runtime-local-runtime-test');

afterEach(() => {
  rmSync(tempDir, { force: true, recursive: true });
});

describe('readLocalStateFile', () => {
  it('returns null for invalid state payloads', () => {
    mkdirSync(tempDir, { recursive: true });
    const stateFile = resolve(tempDir, 'invalid.json');
    writeFileSync(stateFile, '{"profile":"local-keycloak"}\n', 'utf8');

    expect(readLocalStateFile(stateFile)).toBeNull();
  });

  it('parses valid local state payloads', () => {
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
  it('runs local provisioning workers only for real local auth profiles', () => {
    expect(shouldRunLocalProvisioningWorker('local-keycloak')).toBe(true);
    expect(shouldRunLocalProvisioningWorker('local-builder')).toBe(false);
    expect(shouldRunLocalProvisioningWorker('studio')).toBe(false);
  });

  it('checks registry drift only before up/update commands', () => {
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('up')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('update')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('migrate')).toBe(false);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('reconcile')).toBe(false);
  });
});
