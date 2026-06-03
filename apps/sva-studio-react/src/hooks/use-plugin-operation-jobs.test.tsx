import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioJobDetail, StudioJobListItem, StudioJobListQuery } from '@sva/core';

import { usePluginOperationJobDetail, usePluginOperationJobs } from './use-plugin-operation-jobs';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const listPluginOperationJobsMock = vi.fn();
const getPluginOperationJobMock = vi.fn();
const asIamErrorMock = vi.fn();

vi.mock('../lib/iam-api', () => ({
  asIamError: (...args: Parameters<typeof asIamErrorMock>) => asIamErrorMock(...args),
  getPluginOperationJob: (...args: Parameters<typeof getPluginOperationJobMock>) => getPluginOperationJobMock(...args),
  listPluginOperationJobs: (...args: Parameters<typeof listPluginOperationJobsMock>) => listPluginOperationJobsMock(...args),
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

const activeQuery: StudioJobListQuery = {
  page: 1,
  pageSize: 25,
  view: 'active',
};

const activeJobListItem: StudioJobListItem = {
  id: 'job-1',
  instanceId: 'instance-1',
  source: 'plugin',
  pluginId: 'plugin.news',
  jobTypeId: 'news.import',
  status: 'running',
  progress: {
    completedSteps: 1,
    totalSteps: 4,
    currentStepKey: 'fetch',
    currentStepLabel: 'Daten laden',
  },
  attempts: 1,
  maxAttempts: 3,
  correlationId: 'corr-1',
  parentJobId: undefined,
  workerId: 'worker-1',
  startedAt: '2026-05-09T10:00:00.000Z',
  finishedAt: undefined,
  createdAt: '2026-05-09T09:59:00.000Z',
  updatedAt: '2026-05-09T10:00:00.000Z',
  lastProgressAt: '2026-05-09T10:00:00.000Z',
  heartbeatAt: '2026-05-09T10:00:00.000Z',
  latestEvent: {
    id: 'event-1',
    jobId: 'job-1',
    instanceId: 'instance-1',
    eventType: 'job.started',
    status: 'running',
    attempts: 1,
    message: 'Gestartet',
    createdAt: '2026-05-09T10:00:00.000Z',
    details: {
      host: {
        pluginId: 'plugin.news',
        jobTypeId: 'news.import',
      },
    },
    presentation: {
      isTerminal: false,
      title: 'Gestartet',
      tone: 'info',
    },
  },
  runtime: {
    cancellationRequested: false,
    staleAfterSeconds: 120,
    staleState: 'fresh',
    evaluatedAt: '2026-05-09T10:00:00.000Z',
    lastObservedAt: '2026-05-09T10:00:00.000Z',
  },
};

const runningJobDetail: StudioJobDetail = {
  id: 'job-1',
  instanceId: 'instance-1',
  source: 'plugin',
  pluginId: 'plugin.news',
  jobTypeId: 'news.import',
  queueName: 'plugin-operations',
  status: 'running',
  progress: {
    completedSteps: 2,
    totalSteps: 5,
    currentPhase: 'mapping',
    currentStepKey: 'normalize',
    currentStepLabel: 'Normalisieren',
  },
  inputPayload: {},
  resultPayload: undefined,
  errorPayload: undefined,
  attempts: 1,
  maxAttempts: 3,
  idempotencyKey: 'idem-1',
  requestId: 'request-1',
  actorAccountId: 'actor-1',
  workerId: 'worker-1',
  heartbeatAt: '2026-05-09T10:00:00.000Z',
  lastProgressAt: '2026-05-09T10:00:00.000Z',
  cancelRequestedAt: undefined,
  correlationId: 'corr-1',
  parentJobId: undefined,
  scheduledAt: '2026-05-09T09:59:00.000Z',
  startedAt: '2026-05-09T10:00:00.000Z',
  finishedAt: undefined,
  createdAt: '2026-05-09T09:59:00.000Z',
  updatedAt: '2026-05-09T10:00:00.000Z',
  latestEvent: activeJobListItem.latestEvent,
  history: [],
  runtime: {
    cancellationRequested: false,
    staleAfterSeconds: 120,
    staleState: 'fresh',
    evaluatedAt: '2026-05-09T10:00:00.000Z',
    lastObservedAt: '2026-05-09T10:00:00.000Z',
  },
};

describe('usePluginOperationJobs', () => {
  beforeEach(() => {
    listPluginOperationJobsMock.mockReset();
    getPluginOperationJobMock.mockReset();
    asIamErrorMock.mockReset();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.error.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads jobs immediately, supports manual refetch, and polls active views', async () => {
    let intervalCallback: (() => void) | undefined;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number) => {
      if (timeout === 10_000) {
        intervalCallback = handler as () => void;
        return 1 as unknown as ReturnType<typeof window.setInterval>;
      }

      return originalSetInterval(handler, timeout);
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);

    listPluginOperationJobsMock.mockResolvedValue({
      data: [activeJobListItem],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });

    const { result } = renderHook(({ query }: { query: StudioJobListQuery }) => usePluginOperationJobs(query), {
      initialProps: { query: activeQuery },
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.total).toBe(1);
    });

    expect(listPluginOperationJobsMock).toHaveBeenCalledWith(activeQuery, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);

    await act(async () => {
      await result.current.refetch();
    });

    expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
    expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(3);
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    originalClearInterval(1 as unknown as number);
    expect(clearIntervalSpy).not.toHaveBeenCalledWith(1 as unknown as number);
  });

  it('stops polling for history views and exposes structured list errors', async () => {
    const originalSetInterval = window.setInterval;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number) => {
      return originalSetInterval(handler, timeout);
    }) as typeof window.setInterval);
    const apiError = {
      code: 'database_unavailable',
      message: 'db down',
      status: 503,
    };
    listPluginOperationJobsMock.mockRejectedValue(apiError);
    asIamErrorMock.mockReturnValue(apiError);

    const { result } = renderHook(() =>
      usePluginOperationJobs({
        page: 1,
        pageSize: 25,
        view: 'history',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(apiError);
    });

    expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy.mock.calls.filter(([, timeout]) => timeout === 10_000)).toHaveLength(0);
    expect(browserLoggerMock.warn).toHaveBeenCalledWith(
      'studio_plugin_operation_jobs_list_failed',
      expect.objectContaining({
        error_code: 'database_unavailable',
        operation: 'list_plugin_operation_jobs',
      })
    );
  });

  it('logs aborted list requests without surfacing an error', async () => {
    let abortedSignal: AbortSignal | undefined;
    const pendingError = new Error('aborted');

    listPluginOperationJobsMock.mockImplementation(
      async (_query: StudioJobListQuery, options?: { signal?: AbortSignal }) => {
        abortedSignal = options?.signal;
        await new Promise<never>((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(pendingError);
          });
        });
      }
    );

    const { result, unmount } = renderHook(() => usePluginOperationJobs(activeQuery));

    await waitFor(() => {
      expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isLoading).toBe(true);
    unmount();

    await waitFor(() => {
      expect(abortedSignal?.aborted).toBe(true);
      expect(browserLoggerMock.debug).toHaveBeenCalledWith(
        'studio_plugin_operation_jobs_list_aborted',
        expect.objectContaining({
          operation: 'list_plugin_operation_jobs',
          result: 'aborted',
          view: 'active',
        })
      );
    });

    expect(result.current.error).toBeNull();
  });

  it('keeps the newest list response when an older request resolves later', async () => {
    let resolveFirst:
      | ((value: { data: readonly StudioJobListItem[]; pagination: { page: number; pageSize: number; total: number } }) => void)
      | undefined;
    let resolveSecond:
      | ((value: { data: readonly StudioJobListItem[]; pagination: { page: number; pageSize: number; total: number } }) => void)
      | undefined;

    listPluginOperationJobsMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result, rerender } = renderHook(
      ({ query }: { query: StudioJobListQuery }) => usePluginOperationJobs(query),
      {
        initialProps: { query: activeQuery },
      }
    );

    await waitFor(() => {
      expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(1);
    });

    rerender({
      query: {
        ...activeQuery,
        q: 'newer-query',
      },
    });

    await waitFor(() => {
      expect(listPluginOperationJobsMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveSecond?.({
        data: [
          {
            ...activeJobListItem,
            id: 'job-new',
            correlationId: 'corr-new',
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['job-new']);
    });

    await act(async () => {
      resolveFirst?.({
        data: [
          {
            ...activeJobListItem,
            id: 'job-old',
            correlationId: 'corr-old',
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual(['job-new']);
    });
  });
});

describe('usePluginOperationJobDetail', () => {
  beforeEach(() => {
    getPluginOperationJobMock.mockReset();
    asIamErrorMock.mockReset();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.error.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an idle state for empty job ids', async () => {
    const { result } = renderHook(() => usePluginOperationJobDetail(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.detail).toBeNull();
      expect(result.current.error).toBeNull();
    });

    expect(getPluginOperationJobMock).not.toHaveBeenCalled();
  });

  it('loads a running job, refetches manually, and polls until the job is terminal', async () => {
    let intervalCallback: (() => void) | undefined;
    const originalSetInterval = window.setInterval;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number) => {
      if (timeout === 10_000) {
        intervalCallback = handler as () => void;
        return 1 as unknown as ReturnType<typeof window.setInterval>;
      }

      return originalSetInterval(handler, timeout);
    }) as typeof window.setInterval);

    getPluginOperationJobMock
      .mockResolvedValueOnce(runningJobDetail)
      .mockResolvedValueOnce(runningJobDetail)
      .mockResolvedValueOnce({
        ...runningJobDetail,
        status: 'succeeded',
        finishedAt: '2026-05-09T10:10:00.000Z',
      });

    const { result } = renderHook(() => usePluginOperationJobDetail('job-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.detail?.status).toBe('running');
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(getPluginOperationJobMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.detail?.status).toBe('succeeded');
      expect(getPluginOperationJobMock).toHaveBeenCalledTimes(3);
    });

    expect(getPluginOperationJobMock).toHaveBeenCalledTimes(3);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
  });

  it('exposes detail errors when loading fails', async () => {
    const apiError = {
      code: 'not_found',
      message: 'Job fehlt',
      status: 404,
    };
    getPluginOperationJobMock.mockRejectedValue(apiError);
    asIamErrorMock.mockReturnValue(apiError);

    const { result } = renderHook(() => usePluginOperationJobDetail('job-missing'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(apiError);
    });

    expect(browserLoggerMock.warn).toHaveBeenCalledWith(
      'studio_plugin_operation_job_detail_failed',
      expect.objectContaining({
        error_code: 'not_found',
        job_id: 'job-missing',
        operation: 'get_plugin_operation_job',
      })
    );
  });

  it('does not poll terminal jobs and logs aborted detail requests', async () => {
    let abortedSignal: AbortSignal | undefined;
    const terminalJob: StudioJobDetail = {
      ...runningJobDetail,
      status: 'failed',
      finishedAt: '2026-05-09T10:05:00.000Z',
    };
    const originalSetInterval = window.setInterval;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number) => {
      return originalSetInterval(handler, timeout);
    }) as typeof window.setInterval);

    getPluginOperationJobMock.mockResolvedValueOnce(terminalJob).mockImplementationOnce(
      async (_jobId: string, options?: { signal?: AbortSignal }) => {
        abortedSignal = options?.signal;
        await new Promise<never>((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      }
    );

    const { result, rerender, unmount } = renderHook(({ jobId }: { jobId: string }) => usePluginOperationJobDetail(jobId), {
      initialProps: { jobId: 'job-1' },
    });

    await waitFor(() => {
      expect(result.current.detail?.status).toBe('failed');
      expect(result.current.isLoading).toBe(false);
    });

    expect(setIntervalSpy.mock.calls.filter(([, timeout]) => timeout === 10_000)).toHaveLength(0);

    rerender({ jobId: 'job-2' });

    await waitFor(() => {
      expect(getPluginOperationJobMock).toHaveBeenCalledTimes(2);
    });

    unmount();

    await waitFor(() => {
      expect(abortedSignal?.aborted).toBe(true);
      expect(browserLoggerMock.debug).toHaveBeenCalledWith(
        'studio_plugin_operation_job_detail_aborted',
        expect.objectContaining({
          job_id: 'job-2',
          operation: 'get_plugin_operation_job',
          result: 'aborted',
        })
      );
    });
  });

  it('keeps the newest detail response when an older job request resolves later', async () => {
    let resolveFirst: ((value: StudioJobDetail) => void) | undefined;
    let resolveSecond: ((value: StudioJobDetail) => void) | undefined;

    getPluginOperationJobMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string }) => usePluginOperationJobDetail(jobId),
      {
        initialProps: { jobId: 'job-1' },
      }
    );

    await waitFor(() => {
      expect(getPluginOperationJobMock).toHaveBeenCalledTimes(1);
    });

    rerender({ jobId: 'job-2' });

    await waitFor(() => {
      expect(getPluginOperationJobMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveSecond?.({
        ...runningJobDetail,
        id: 'job-2',
        correlationId: 'corr-2',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.detail?.id).toBe('job-2');
    });

    await act(async () => {
      resolveFirst?.({
        ...runningJobDetail,
        id: 'job-1',
        correlationId: 'corr-1',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.detail?.id).toBe('job-2');
    });
  });
});
