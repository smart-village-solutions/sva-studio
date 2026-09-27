import { describe, expect, it } from 'vitest';

import { deriveWasteMainserverSyncStatus } from './waste-management-mainserver-sync-status.js';

const successfulSync = {
  id: 'job-1',
  status: 'succeeded' as const,
  finishedAt: '2026-08-27T12:00:00.000Z',
  sourceRevision: '7',
  yearWindow: [2026, 2027] as const,
};

describe('deriveWasteMainserverSyncStatus', () => {
  it('is clean only when revision and year window match the last successful job', () => {
    expect(
      deriveWasteMainserverSyncStatus({
        currentYear: 2026,
        jobsAvailable: true,
        sourceRevision: { sourceRevision: '7' },
        lastSuccessfulSync: successfulSync,
      }).sourceState
    ).toBe('clean');
  });

  it.each([
    [{ sourceRevision: '8' }, successfulSync],
    [{ sourceRevision: '7' }, { ...successfulSync, yearWindow: [2025, 2026] as const }],
    [{ sourceRevision: '0' }, undefined],
  ])(
    'keeps a changed, year-shifted, or never synchronized source pending',
    (sourceRevision, lastSuccessfulSync) => {
      expect(
        deriveWasteMainserverSyncStatus({
          currentYear: 2026,
          jobsAvailable: true,
          sourceRevision,
          lastSuccessfulSync,
        }).sourceState
      ).toBe('pending');
    }
  );

  it('fails closed for unavailable job data or invalid legacy revisions', () => {
    expect(
      deriveWasteMainserverSyncStatus({
        currentYear: 2026,
        jobsAvailable: false,
        sourceRevision: { sourceRevision: '7' },
        lastSuccessfulSync: successfulSync,
      }).sourceState
    ).toBe('unknown');
    expect(
      deriveWasteMainserverSyncStatus({
        currentYear: 2026,
        jobsAvailable: true,
        sourceRevision: { sourceRevision: 'invalid' },
      }).sourceState
    ).toBe('unknown');
    expect(
      deriveWasteMainserverSyncStatus({
        currentYear: 2026,
        jobsAvailable: true,
        sourceRevision: { sourceRevision: '6' },
        lastSuccessfulSync: successfulSync,
      }).sourceState
    ).toBe('unknown');
  });

  it('keeps an active job separate from the pending source state', () => {
    const status = deriveWasteMainserverSyncStatus({
      currentYear: 2026,
      jobsAvailable: true,
      sourceRevision: { sourceRevision: '8' },
      lastSuccessfulSync: successfulSync,
      activeJob: { id: 'job-2', status: 'running' },
    });

    expect(status).toMatchObject({
      sourceState: 'pending',
      activeJob: { id: 'job-2', status: 'running' },
    });
  });
});
