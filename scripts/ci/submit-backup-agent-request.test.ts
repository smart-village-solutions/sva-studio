import { describe, expect, it } from 'vitest';
import { buildBackupAgentRequest } from './submit-backup-agent-request.ts';

describe('backup agent request submission', () => {
  it('creates a short-lived environment-bound request', () => {
    expect(buildBackupAgentRequest({ environment: 'prod', deployImageDigest: `sha256:${'b'.repeat(64)}`, maintenanceWindowReference: 'CAB-42', now: new Date('2026-07-30T10:00:00.000Z'), requestId: 'gha-12345678' })).toMatchObject({ environment: 'prod', expiresAt: '2026-07-30T10:10:00.000Z', maintenanceWindowReference: 'CAB-42' });
  });
});
