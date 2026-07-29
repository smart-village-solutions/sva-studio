import { describe, expect, it } from 'vitest';

import { backupEnvironmentConfig, isValidBackupRequest, signBackupRequest, verifyBackupRequestSignature, type BackupRequest } from './backup-agent-contract.ts';

const stagingRequest: BackupRequest = {
  version: 1,
  action: 'backup-and-verify',
  requestId: 'gha-12345678',
  environment: 'staging',
  deployImageDigest: `sha256:${'a'.repeat(64)}`,
  expiresAt: '2026-07-30T10:00:00.000Z',
};

describe('backup agent contract', () => {
  it('derives endpoints and buckets only from the accepted environment', () => {
    expect(backupEnvironmentConfig('staging')).toEqual({
      bucket: 'studio-db-backup-staging',
      endpoint: 'https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests',
      objectPrefix: 'staging',
    });
    expect(backupEnvironmentConfig('prod')).toEqual({
      bucket: 'studio-db-backup-production',
      endpoint: 'https://backup-studio.smart-village.app/_ops/backup/v1/requests',
      objectPrefix: 'prod',
    });
    expect(backupEnvironmentConfig('staging').endpoint).not.toContain('://studio-staging.');
    expect(backupEnvironmentConfig('prod').endpoint).not.toContain('://studio.');
  });

  it('accepts valid signed requests and rejects signature changes', () => {
    const signature = signBackupRequest(stagingRequest, 'staging-key');
    expect(verifyBackupRequestSignature(stagingRequest, 'staging-key', signature)).toBe(true);
    expect(verifyBackupRequestSignature(stagingRequest, 'production-key', signature)).toBe(false);
  });

  it('requires production maintenance evidence and a future expiry', () => {
    expect(isValidBackupRequest(stagingRequest, new Date('2026-07-30T09:50:00.000Z'))).toBe(true);
    expect(isValidBackupRequest({ ...stagingRequest, environment: 'prod' }, new Date('2026-07-30T09:50:00.000Z'))).toBe(false);
    expect(isValidBackupRequest({ ...stagingRequest, environment: 'prod', maintenanceWindowReference: 'CAB-42' }, new Date('2026-07-30T09:50:00.000Z'))).toBe(true);
    expect(isValidBackupRequest(stagingRequest, new Date('2026-07-30T10:00:00.000Z'))).toBe(false);
    expect(isValidBackupRequest(stagingRequest, new Date('2026-07-30T09:49:59.999Z'))).toBe(false);
  });
});
