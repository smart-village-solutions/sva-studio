import { describe, expect, it } from 'vitest';

import { readSnapshotFromRuns } from './service-keycloak-snapshot-reader.js';

describe('readSnapshotFromRuns', () => {
  it('uses the newest matching worker snapshot when an older final snapshot has stale inputs', () => {
    const runs = [
      {
        steps: [
          {
            stepKey: 'worker_preflight_snapshot',
            details: { policyVersion: 3, inputFingerprint: 'current', preflight: { source: 'worker' } },
          },
        ],
      },
      {
        steps: [
          {
            stepKey: 'status_snapshot',
            details: { policyVersion: 3, inputFingerprint: 'stale', preflight: { source: 'final' } },
          },
        ],
      },
    ] as never;

    expect(
      readSnapshotFromRuns<{ source: string }>(
        runs,
        ['status_snapshot', 'worker_preflight_snapshot'],
        'preflight',
        3,
        'current'
      )
    ).toEqual({ source: 'worker' });
  });

  it('prefers a matching final snapshot within the same run', () => {
    const runs = [
      {
        steps: [
          {
            stepKey: 'worker_plan_snapshot',
            details: { policyVersion: 3, inputFingerprint: 'current', plan: { source: 'worker' } },
          },
          {
            stepKey: 'status_snapshot',
            details: { policyVersion: 3, inputFingerprint: 'current', plan: { source: 'final' } },
          },
        ],
      },
    ] as never;

    expect(
      readSnapshotFromRuns<{ source: string }>(
        runs,
        ['status_snapshot', 'worker_plan_snapshot'],
        'plan',
        3,
        'current'
      )
    ).toEqual({ source: 'final' });
  });
});
