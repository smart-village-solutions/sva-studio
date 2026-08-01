import { describe, expect, it } from 'vitest';

import { buildRestoreAgentRequest } from './submit-restore-agent-request.ts';

describe('submit restore agent request', () => {
  it('builds the complete short-lived workflow request', () => {
    expect(
      buildRestoreAgentRequest({
        environment: 'prod',
        maintenanceWindowReference: 'INC-42',
        now: new Date('2026-08-01T10:00:00.000Z'),
        requestId: 'restore-gha-123-1',
        sourceObjectKey: `prod/2026-08-01/${'a'.repeat(64)}/backup.dump`,
        sourceSha256: 'b'.repeat(64),
      })
    ).toEqual({
      version: 1,
      action: 'restore-and-verify-v1',
      requestId: 'restore-gha-123-1',
      environment: 'prod',
      expiresAt: '2026-08-01T10:10:00.000Z',
      maintenanceWindowReference: 'INC-42',
      sourceObjectKey: `prod/2026-08-01/${'a'.repeat(64)}/backup.dump`,
      sourceSha256: 'b'.repeat(64),
    });
  });
});
