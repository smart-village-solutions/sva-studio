import { describe, expect, it } from 'vitest';

import {
  buildRestoreAgentRequest,
  hasRuntimePrincipalRestoreEvidence,
} from './submit-restore-agent-request.ts';

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

  it('accepts only restore evidence containing reconciliation and principal probes', () => {
    const steps = [
      { step: 'runtime-principal-reconciliation', status: 'succeeded' },
      { step: 'runtime-principal-probe', status: 'succeeded' },
    ];
    expect(hasRuntimePrincipalRestoreEvidence({ steps })).toBe(true);
    expect(hasRuntimePrincipalRestoreEvidence({ steps: steps.slice(0, 1) })).toBe(false);
    expect(
      hasRuntimePrincipalRestoreEvidence({
        steps: [steps[0], { ...steps[1], status: 'failed' }],
      })
    ).toBe(false);
  });

  it('includes the tenant identity in Waste restore requests', () => {
    expect(buildRestoreAgentRequest({
      environment: 'staging',
      maintenanceWindowReference: 'DRILL-42',
      now: new Date('2026-08-01T10:00:00.000Z'),
      requestId: 'restore-gha-456-1',
      sourceObjectKey: 'staging/waste/bb-prignitz/run/source.dump',
      sourceSha256: 'c'.repeat(64),
      database: 'waste',
      tenantInstanceId: 'bb-prignitz',
    })).toMatchObject({ database: 'waste', tenantInstanceId: 'bb-prignitz' });
  });
});
