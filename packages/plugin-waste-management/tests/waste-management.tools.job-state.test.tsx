import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWasteTrackedJob } from '../src/waste-management.tools.job-state.js';

const getWasteManagementJobDetailMock = vi.hoisted(() => vi.fn());

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementJobDetail: (...args: Parameters<typeof getWasteManagementJobDetailMock>) =>
    getWasteManagementJobDetailMock(...args),
}));

describe('useWasteTrackedJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getWasteManagementJobDetailMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls a running job and stops after a terminal status', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setLastJob = vi.fn();

    getWasteManagementJobDetailMock
      .mockResolvedValueOnce({
        id: 'job-1',
        instanceId: 'tenant-a',
        pluginId: 'waste-management',
        jobTypeId: 'waste-management.apply-migrations',
        queueName: 'plugin-operations',
        status: 'running',
        inputPayload: { operation: 'apply-migrations' },
        attempts: 1,
        maxAttempts: 5,
        idempotencyKey: 'idem-1',
        scheduledAt: '2026-05-10T10:00:00.000Z',
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:05.000Z',
        history: [],
      })
      .mockResolvedValueOnce({
        id: 'job-1',
        instanceId: 'tenant-a',
        pluginId: 'waste-management',
        jobTypeId: 'waste-management.apply-migrations',
        queueName: 'plugin-operations',
        status: 'succeeded',
        inputPayload: { operation: 'apply-migrations' },
        attempts: 1,
        maxAttempts: 5,
        idempotencyKey: 'idem-1',
        scheduledAt: '2026-05-10T10:00:00.000Z',
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:10.000Z',
        finishedAt: '2026-05-10T10:00:10.000Z',
        history: [],
      });

    const { rerender } = renderHook(
      ({ lastJob }) =>
        useWasteTrackedJob({
          lastJob,
          refreshTechnicalHistory,
          setLastJob,
        }),
      {
        initialProps: {
          lastJob: {
            id: 'job-1',
            jobTypeId: 'waste-management.apply-migrations',
            status: 'queued',
          } as never,
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(getWasteManagementJobDetailMock).toHaveBeenCalledTimes(1);
    expect(setLastJob).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'running' }));
    expect(refreshTechnicalHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(getWasteManagementJobDetailMock).toHaveBeenCalledTimes(2);
    expect(setLastJob).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'succeeded' }));
    expect(refreshTechnicalHistory).toHaveBeenCalledTimes(2);

    rerender({
      lastJob: {
        id: 'job-1',
        jobTypeId: 'waste-management.apply-migrations',
        status: 'succeeded',
      } as never,
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(getWasteManagementJobDetailMock).toHaveBeenCalledTimes(2);
  });
});
