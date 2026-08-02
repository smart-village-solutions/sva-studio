import { describe, expect, it } from 'vitest';
import { backupAgentAcceptanceTimeoutMs, buildBackupAgentRequest } from './submit-backup-agent-request.ts';

describe('backup agent request submission', () => {
  it('creates a short-lived environment-bound request', () => {
    expect(buildBackupAgentRequest({ environment: 'prod', deployImageDigest: `sha256:${'b'.repeat(64)}`, now: new Date('2026-07-30T10:00:00.000Z'), requestId: 'gha-12345678' })).toEqual({
      action: 'backup-and-verify',
      deployImageDigest: `sha256:${'b'.repeat(64)}`,
      environment: 'prod',
      expiresAt: '2026-07-30T10:10:00.000Z',
      requestId: 'gha-12345678',
      version: 2,
    });
  });

  it('allows a bounded minute for authenticated request acceptance', () => {
    expect(backupAgentAcceptanceTimeoutMs).toBe(60_000);
  });
});
