import { describe, expect, it } from 'vitest';

import type { ContentProjectionSyncState } from './iam-content-list-projection-model.server.js';
import { isProjectionRefreshDue } from './iam-content-list-projection-sync.server.js';

const failedState = (lastErrorCode: string, lastFailedAt: string): ContentProjectionSyncState => ({
  contentType: 'news.article',
  lastFailedAt,
  lastErrorCode,
  isStale: true,
  isSyncRunning: false,
  hasSnapshot: false,
  snapshotState: 'empty',
  completedPage: 0,
  availableCount: 0,
  isTotalFinal: false,
  skippedInvalidCount: 0,
});

describe('isProjectionRefreshDue', () => {
  const nowMs = Date.parse('2026-09-13T12:15:00.000Z');

  it.each([
    ['scheduler', false],
    ['reconciliation', true],
    ['mutation_follow_up', true],
  ] as const)('holds automatic %s retries even when force is %s', (trigger, force) => {
    expect(
      isProjectionRefreshDue({
        state: failedState('mainserver_credentials_missing', '2026-09-13T12:00:01.000Z'),
        options: { force, awaitCompletion: false, trigger },
        nowMs,
      })
    ).toBe(false);
  });

  it.each(['mainserver_credentials_partial', 'mainserver_credentials_stale'])(
    'holds scheduler retries for recent durable error %s',
    (errorCode) => {
      expect(
        isProjectionRefreshDue({
          state: failedState(errorCode, '2026-09-13T12:00:01.000Z'),
          options: { force: false, awaitCompletion: false, trigger: 'scheduler' },
          nowMs,
        })
      ).toBe(false);
    }
  );

  it('retries a durable credential error after fifteen minutes', () => {
    expect(
      isProjectionRefreshDue({
        state: failedState('mainserver_credentials_missing', '2026-09-13T12:00:00.000Z'),
        options: { force: false, awaitCompletion: false, trigger: 'scheduler' },
        nowMs,
      })
    ).toBe(true);
  });

  it('keeps transient failures on the existing retry cadence', () => {
    expect(
      isProjectionRefreshDue({
        state: failedState('mainserver_credentials_unavailable', '2026-09-13T12:14:59.000Z'),
        options: { force: false, awaitCompletion: false, trigger: 'scheduler' },
        nowMs,
      })
    ).toBe(true);
  });

  it('allows an explicit manual refresh before the cooldown expires', () => {
    expect(
      isProjectionRefreshDue({
        state: failedState('mainserver_credentials_partial', '2026-09-13T12:14:59.000Z'),
        options: { force: true, awaitCompletion: true, trigger: 'manual' },
        nowMs,
      })
    ).toBe(true);
  });
});
