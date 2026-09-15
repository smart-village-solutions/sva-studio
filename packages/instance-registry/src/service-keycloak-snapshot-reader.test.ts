import { describe, expect, it } from 'vitest';

import {
  isRealmBaselineApplicable,
  readSnapshotFromRuns,
} from './service-keycloak-snapshot-reader.js';

describe('isRealmBaselineApplicable', () => {
  it('recognizes a realm created by any successful new-mode Keycloak run', () => {
    expect(
      isRealmBaselineApplicable(
        'existing',
        [
          {
            mode: 'new',
            overallStatus: 'succeeded',
            steps: [
              { stepKey: 'realm_baseline', status: 'done' },
              {
                stepKey: 'status_snapshot',
                status: 'done',
                details: { policyVersion: 3, authRealm: 'current', authClientId: 'current-client' },
              },
            ],
          },
        ] as never,
        'current',
        'current-client'
      )
    ).toBe(true);
  });

  it('does not carry managed provenance to a different current realm', () => {
    expect(
      isRealmBaselineApplicable(
        'existing',
        [
          {
            mode: 'new',
            overallStatus: 'succeeded',
            steps: [
              { stepKey: 'realm_baseline', status: 'done' },
              {
                stepKey: 'status_snapshot',
                status: 'done',
                details: {
                  policyVersion: 3,
                  authRealm: 'previous-realm',
                  authClientId: 'current-client',
                },
              },
            ],
          },
        ] as never,
        'current-realm',
        'current-client'
      )
    ).toBe(false);
  });

  it('does not carry managed provenance to a different current client', () => {
    expect(
      isRealmBaselineApplicable(
        'existing',
        [
          {
            mode: 'new',
            overallStatus: 'succeeded',
            steps: [
              { stepKey: 'realm_baseline', status: 'done' },
              {
                stepKey: 'status_snapshot',
                status: 'done',
                details: {
                  policyVersion: 3,
                  authRealm: 'current',
                  authClientId: 'previous-client',
                },
              },
            ],
          },
        ] as never,
        'current',
        'current-client'
      )
    ).toBe(false);
  });

  it('keeps a retained realm managed after a post-baseline local failure', () => {
    expect(
      isRealmBaselineApplicable(
        'existing',
        [
          {
            mode: 'new',
            overallStatus: 'failed',
            steps: [
              { stepKey: 'realm_baseline', status: 'done' },
              { stepKey: 'admin_bootstrap', status: 'failed' },
              {
                stepKey: 'status_snapshot',
                status: 'done',
                details: { policyVersion: 3, authRealm: 'current', authClientId: 'current-client' },
              },
            ],
          },
        ] as never,
        'current',
        'current-client'
      )
    ).toBe(true);
  });

  it('does not keep compensated new-mode runs as managed provenance', () => {
    expect(
      isRealmBaselineApplicable(
        'existing',
        [
          {
            mode: 'new',
            overallStatus: 'failed',
            steps: [
              { stepKey: 'realm_baseline', status: 'done' },
              { stepKey: 'worker_complete', status: 'failed' },
              {
                stepKey: 'status_snapshot',
                status: 'done',
                details: { policyVersion: 3, authRealm: 'current', authClientId: 'current-client' },
              },
            ],
          },
        ] as never,
        'current',
        'current-client'
      )
    ).toBe(false);
  });

  it('does not treat imported existing realms as managed', () => {
    expect(isRealmBaselineApplicable('existing', [], 'current', 'current-client')).toBe(false);
  });
});

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
