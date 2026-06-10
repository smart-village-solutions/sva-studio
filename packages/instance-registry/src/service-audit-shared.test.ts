import { describe, expect, it } from 'vitest';

import {
  aggregateStatuses,
  CHECK_IDS,
  createCheck,
  createSkipCheck,
  mapWithConcurrencyLimit,
  toSummary,
} from './service-audit-shared.js';

describe('service-audit-shared', () => {
  it('aggregates fail, warn, pass and skip in severity order', () => {
    expect(aggregateStatuses(['skip', 'pass'])).toBe('pass');
    expect(aggregateStatuses(['skip', 'warn'])).toBe('warn');
    expect(aggregateStatuses(['pass', 'fail'])).toBe('fail');
    expect(aggregateStatuses(['skip'])).toBe('skip');
  });

  it('creates skip checks with the expected default actual value', () => {
    expect(
      createSkipCheck(
        CHECK_IDS.keycloakLoginClientExists,
        'Titel',
        'keycloak',
        'Erwartung',
        'evidence',
        'Nachricht'
      )
    ).toEqual(
      expect.objectContaining({
        status: 'skip',
        actual: 'nicht geprüft',
        evidenceSource: 'evidence',
      })
    );
  });

  it('limits concurrent workers and keeps result order', async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrencyLimit([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => globalThis.setTimeout(resolve, value === 1 ? 10 : 1));
      active -= 1;
      return value * 10;
    });

    expect(maxActive).toBe(2);
    expect(results).toEqual([10, 20, 30, 40]);
  });

  it('returns an empty result list for empty concurrency inputs', async () => {
    await expect(mapWithConcurrencyLimit([], 3, async () => 'x')).resolves.toEqual([]);
  });

  it('summarizes instance and run statuses', () => {
    const summary = toSummary(
      [
        {
          instanceId: 'demo',
          displayName: 'Demo',
          status: 'active',
          primaryHostname: 'demo.example.org',
          overallStatus: 'fail',
          checks: [
            createCheck({
              checkId: CHECK_IDS.instanceUrlReachable,
              title: 'URL',
              scope: 'instance',
              status: 'pass',
              expected: '200',
              actual: '200',
              evidenceSource: 'probe',
              message: 'ok',
            }),
            createCheck({
              checkId: CHECK_IDS.keycloakRealmExists,
              title: 'Realm',
              scope: 'keycloak',
              status: 'fail',
              expected: 'vorhanden',
              actual: 'fehlt',
              evidenceSource: 'keycloak',
              message: 'nein',
            }),
          ],
        },
      ],
      [
        createCheck({
          checkId: CHECK_IDS.runTargetsPresent,
          title: 'Targets',
          scope: 'run',
          status: 'warn',
          expected: '>=1',
          actual: '1',
          evidenceSource: 'instance_registry',
          message: 'geladen',
        }),
      ]
    );

    expect(summary).toEqual({
      totalInstances: 1,
      passCount: 1,
      failCount: 1,
      warnCount: 1,
      skipCount: 0,
    });
  });
});
