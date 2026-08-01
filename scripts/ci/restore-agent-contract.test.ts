import { describe, expect, it } from 'vitest';

import {
  canonicalRestoreRequest,
  isValidRestoreRequest,
  restoreEnvironmentConfig,
  signRestoreRequest,
  verifyRestoreRequestSignature,
  type RestoreRequest,
} from './restore-agent-contract.ts';

const request: RestoreRequest = {
  version: 1,
  action: 'restore-and-verify-v1',
  requestId: 'restore-12345678',
  environment: 'staging',
  expiresAt: '2026-08-01T10:10:00.000Z',
  maintenanceWindowReference: 'INC-42/CAB-7',
  sourceObjectKey: `staging/2026-08-01/${'a'.repeat(64)}/gha-12345678.dump`,
  sourceSha256: 'b'.repeat(64),
};

describe('restore agent contract', () => {
  it('accepts only a short-lived, environment-bound v1 request', () => {
    const now = new Date('2026-08-01T10:00:00.000Z');
    expect(isValidRestoreRequest(request, now)).toBe(true);
    expect(isValidRestoreRequest({ ...request, environment: 'prod' }, now)).toBe(false);
    expect(isValidRestoreRequest({ ...request, expiresAt: '2026-08-01T10:10:00.001Z' }, now)).toBe(
      false
    );
    expect(isValidRestoreRequest({ ...request, action: 'backup-and-verify' }, now)).toBe(false);
  });

  it('rejects path traversal, bucket overrides and freely supplied target parameters', () => {
    const now = new Date('2026-08-01T10:00:00.000Z');
    expect(
      isValidRestoreRequest({ ...request, sourceObjectKey: 'staging/../prod/backup.dump' }, now)
    ).toBe(false);
    expect(isValidRestoreRequest({ ...request, bucket: 'attacker-bucket' }, now)).toBe(false);
    expect(isValidRestoreRequest({ ...request, postgresHost: 'attacker.invalid' }, now)).toBe(
      false
    );
    expect(canonicalRestoreRequest(request)).not.toContain('postgres');
    expect(canonicalRestoreRequest(request)).not.toContain('bucket');
  });

  it('uses the dedicated restore route while retaining the fixed environment bucket', () => {
    expect(restoreEnvironmentConfig('staging')).toMatchObject({
      bucket: 'studio-db-backup-staging',
      endpoint: 'https://backup-studio-staging.smart-village.app/_ops/restore/v1/requests',
      objectPrefix: 'staging',
    });
  });

  it('signs the complete canonical request and verifies safely', () => {
    const signature = signRestoreRequest(request, 'secret');
    expect(verifyRestoreRequestSignature(request, 'secret', signature)).toBe(true);
    expect(
      verifyRestoreRequestSignature(
        { ...request, sourceSha256: 'c'.repeat(64) },
        'secret',
        signature
      )
    ).toBe(false);
    expect(verifyRestoreRequestSignature(request, 'secret', 'invalid')).toBe(false);
  });
});
