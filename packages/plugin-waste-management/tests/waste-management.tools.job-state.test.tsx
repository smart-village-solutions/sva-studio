import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wasteManagementOperationsContract } from '@sva/plugin-sdk';

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

  it('polls active import jobs more frequently for live progress updates', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setLastJob = vi.fn();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    getWasteManagementJobDetailMock.mockResolvedValue({
      id: 'job-2',
      instanceId: 'tenant-a',
      pluginId: 'waste-management',
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
      queueName: 'plugin-operations',
      status: 'running',
      inputPayload: { operation: 'import-data' },
      attempts: 1,
      maxAttempts: 5,
      idempotencyKey: 'idem-2',
      scheduledAt: '2026-05-10T10:00:00.000Z',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:05.000Z',
      history: [],
    });

    renderHook(() =>
      useWasteTrackedJob({
        lastJob: {
          id: 'job-2',
          jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
          status: 'running',
        } as never,
        refreshTechnicalHistory,
        setLastJob,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3_000);
  });

  it('ignores failed refresh attempts until a later poll succeeds', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setLastJob = vi.fn();

    getWasteManagementJobDetailMock
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({
        id: 'job-3',
        instanceId: 'tenant-a',
        pluginId: 'waste-management',
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
        queueName: 'plugin-operations',
        status: 'running',
        inputPayload: { operation: 'import-data' },
        attempts: 1,
        maxAttempts: 5,
        idempotencyKey: 'idem-3',
        scheduledAt: '2026-05-10T10:00:00.000Z',
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:03.000Z',
        history: [],
      });

    renderHook(() =>
      useWasteTrackedJob({
        lastJob: {
          id: 'job-3',
          jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
          status: 'running',
        } as never,
        refreshTechnicalHistory,
        setLastJob,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getWasteManagementJobDetailMock).toHaveBeenCalledTimes(1);
    expect(setLastJob).not.toHaveBeenCalled();
    expect(refreshTechnicalHistory).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(getWasteManagementJobDetailMock).toHaveBeenCalledTimes(2);
    expect(setLastJob).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'job-3', status: 'running' }));
    expect(refreshTechnicalHistory).toHaveBeenCalledTimes(1);
  });

  it('invokes the optional terminal callback when a tracked job fails', async () => {
    const refreshTechnicalHistory = vi.fn(async () => undefined);
    const setLastJob = vi.fn();
    const onTerminalJob = vi.fn();

    getWasteManagementJobDetailMock.mockResolvedValue({
      id: 'job-4',
      instanceId: 'tenant-a',
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.sync-waste-types',
      queueName: 'plugin-operations',
      status: 'failed',
      inputPayload: { operation: 'sync-waste-types' },
      attempts: 1,
      maxAttempts: 5,
      idempotencyKey: 'idem-4',
      scheduledAt: '2026-05-10T10:00:00.000Z',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:05.000Z',
      finishedAt: '2026-05-10T10:00:05.000Z',
      history: [],
    });

    renderHook(() =>
      useWasteTrackedJob({
        lastJob: {
          id: 'job-4',
          jobTypeId: 'waste-management.sync-waste-types',
          status: 'queued',
        } as never,
        refreshTechnicalHistory,
        onTerminalJob,
        setLastJob,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(setLastJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-4', status: 'failed' }));
    expect(onTerminalJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-4', status: 'failed' }));
  });
});
