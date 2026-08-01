import { describe, expect, it } from 'vitest';

import { isValidStagingRestoreEvidence } from './verify-staging-restore-evidence.ts';

const evidence = {
  version: 1,
  workflow: 'database-restore',
  environment: 'staging',
  status: 'succeeded',
  requestId: 'restore-gha-12345678-1',
  sourceObjectKey: 'staging/2026-08-01/digest/backup.dump',
  sourceSha256: 'a'.repeat(64),
  safetyBackupObject: 'staging/safety-before-restore/2026-08-01/request.dump',
  healthLive: 'passed',
  healthReady: 'passed',
  tenantLogin: 'passed',
  authenticatedIam: 'passed',
  completedAt: '2026-08-01T10:00:00.000Z',
} as const;

describe('staging restore evidence gate', () => {
  it('accepts complete staging drill evidence', () =>
    expect(isValidStagingRestoreEvidence(evidence)).toBe(true));
  it('rejects production, partial and unsuccessful evidence', () => {
    expect(isValidStagingRestoreEvidence({ ...evidence, environment: 'prod' })).toBe(false);
    expect(isValidStagingRestoreEvidence({ ...evidence, healthReady: 'failed' })).toBe(false);
    expect(isValidStagingRestoreEvidence({ ...evidence, safetyBackupObject: '' })).toBe(false);
    expect(isValidStagingRestoreEvidence({ ...evidence, authenticatedIam: 'failed' })).toBe(false);
  });
});
