import { describe, expect, it, vi } from 'vitest';

import { createJobStateWriter } from './job-state-writer.js';

const baseJob = {
  id: 'job-1',
  instanceId: 'tenant-a',
  pluginId: 'news',
  jobTypeId: 'news.import-articles',
  queueName: 'plugin-operations',
  status: 'queued',
  progress: { completedSteps: 0, totalSteps: 1 },
  inputPayload: {},
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'idem-1',
  scheduledAt: '2026-05-09T12:00:00.000Z',
  createdAt: '2026-05-09T12:00:00.000Z',
  updatedAt: '2026-05-09T12:00:00.000Z',
} as const;

describe('job state writer', () => {
  it('uses the atomic terminal port without issuing independent job or event writes', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendSucceededEvent = vi.fn(async () => null);
    const persistTerminalState = vi.fn(async () => undefined);
    const writer = createJobStateWriter({
      updateJobState,
      appendStartedEvent: vi.fn(async () => null),
      appendSucceededEvent,
      appendRetriedEvent: vi.fn(async () => null),
      appendFailedEvent: vi.fn(async () => null),
      persistTerminalState,
      now: () => '2026-05-09T12:02:00.000Z',
    });

    await writer.markSucceeded({
      job: { ...baseJob, status: 'running', attempts: 1, workerId: 'worker-a' },
      attempts: 1,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'worker-a',
      result: {},
    });

    expect(persistTerminalState).toHaveBeenCalledOnce();
    expect(updateJobState).not.toHaveBeenCalled();
    expect(appendSucceededEvent).not.toHaveBeenCalled();
  });
  it('writes running and success states through injected ports', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendStartedEvent = vi.fn(async () => null);
    const appendSucceededEvent = vi.fn(async () => null);

    const writer = createJobStateWriter({
      updateJobState,
      appendStartedEvent,
      appendSucceededEvent,
      appendRetriedEvent: vi.fn(async () => null),
      appendFailedEvent: vi.fn(async () => null),
      now: () => '2026-05-09T12:02:00.000Z',
    });

    await writer.markRunning({
      job: baseJob,
      attempts: 1,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'graphile-worker:tenant-a:job-1',
    });
    await writer.markSucceeded({
      job: baseJob,
      attempts: 1,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'graphile-worker:tenant-a:job-1',
      result: {
        resultPayload: {
          summary: {
            acceptedItems: 3,
          },
          plugin: {
            acceptedRows: 3,
          },
        },
      },
    });

    expect(updateJobState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: 'running',
        workerId: 'graphile-worker:tenant-a:job-1',
      })
    );
    expect(appendStartedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.started',
      })
    );
    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: 'succeeded',
        resultPayload: {
          summary: {
            acceptedItems: 3,
          },
          plugin: {
            acceptedRows: 3,
          },
        },
      })
    );
    expect(appendSucceededEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.succeeded',
      })
    );
  });

  it('writes a cancelled terminal state with a dedicated lifecycle event', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendFailedEvent = vi.fn(async () => null);
    const appendCancelledEvent = vi.fn(async () => null);

    const writer = createJobStateWriter({
      updateJobState,
      appendStartedEvent: vi.fn(async () => null),
      appendSucceededEvent: vi.fn(async () => null),
      appendRetriedEvent: vi.fn(async () => null),
      appendFailedEvent,
      appendCancelledEvent,
      now: () => '2026-05-09T12:04:00.000Z',
    });

    await writer.markCancelled({
      job: {
        ...baseJob,
        status: 'running',
        cancelRequestedAt: '2026-05-09T12:03:30.000Z',
      },
      attempts: 2,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'graphile-worker:tenant-a:job-1',
      message: 'Plugin operation cancelled.',
    });

    expect(updateJobState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        finishedAt: '2026-05-09T12:04:00.000Z',
      })
    );
    expect(appendCancelledEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.cancelled',
        message: 'Plugin operation cancelled.',
      })
    );
    expect(appendFailedEvent).not.toHaveBeenCalled();
  });

  it('preserves the latest reported progress when retrying or failing after handler work', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendRetriedEvent = vi.fn(async () => null);
    const appendFailedEvent = vi.fn(async () => null);

    const writer = createJobStateWriter({
      updateJobState,
      appendStartedEvent: vi.fn(async () => null),
      appendSucceededEvent: vi.fn(async () => null),
      appendRetriedEvent,
      appendFailedEvent,
      now: () => '2026-05-09T12:05:00.000Z',
    });

    const latestProgress = {
      completedSteps: 2,
      totalSteps: 3,
      currentPhase: 'mapping',
      currentStepKey: 'persist-content',
      lastUpdatedAt: '2026-05-09T12:04:30.000Z',
    } as const;

    await writer.markRetriedOrFailed({
      job: baseJob,
      attempts: 2,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'graphile-worker:tenant-a:job-1',
      progress: latestProgress,
      errorPayload: {
        code: 'plugin_operation_execution_failed',
        category: 'retryable',
      },
      finalFailure: false,
    });

    await writer.markRetriedOrFailed({
      job: baseJob,
      attempts: 5,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'graphile-worker:tenant-a:job-1',
      progress: latestProgress,
      errorPayload: {
        code: 'plugin_operation_execution_failed',
        category: 'permanent',
      },
      finalFailure: true,
    });

    expect(updateJobState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: 'retrying',
        progress: latestProgress,
      })
    );
    expect(appendRetriedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: latestProgress,
      })
    );
    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: 'failed',
        progress: latestProgress,
      })
    );
    expect(appendFailedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: latestProgress,
      })
    );
  });

  it('writes running and retrying states before their events with the same job, tenant, and attempt', async () => {
    const calls: string[] = [];
    const writer = createJobStateWriter({
      updateJobState: vi.fn(async (state) => {
        calls.push(`state:${state.status}:${state.instanceId}:${state.jobId}:${state.attempts}`);
      }),
      appendStartedEvent: vi.fn(async (event) => {
        calls.push(`event:started:${event.instanceId}:${event.jobId}:${event.attempts}`);
      }),
      appendSucceededEvent: vi.fn(async () => null),
      appendRetriedEvent: vi.fn(async (event) => {
        calls.push(`event:retried:${event.instanceId}:${event.jobId}:${event.attempts}`);
      }),
      appendFailedEvent: vi.fn(async () => null),
      now: () => '2026-05-09T12:05:00.000Z',
    });

    const input = {
      job: baseJob,
      attempts: 2,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'worker-a',
    };
    await writer.markRunning(input);
    await writer.markRetriedOrFailed({
      ...input,
      errorPayload: { code: 'retry', category: 'retryable' },
      finalFailure: false,
    });

    expect(calls).toEqual([
      'state:running:tenant-a:job-1:2',
      'event:started:tenant-a:job-1:2',
      'state:retrying:tenant-a:job-1:2',
      'event:retried:tenant-a:job-1:2',
    ]);
  });

  it('keeps terminal writes concurrent in the legacy fallback', async () => {
    let finishUpdate: (() => void) | undefined;
    const updateJobState = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpdate = resolve;
        })
    );
    const appendSucceededEvent = vi.fn(async () => undefined);
    const writer = createJobStateWriter({
      updateJobState,
      appendStartedEvent: vi.fn(async () => undefined),
      appendSucceededEvent,
      appendRetriedEvent: vi.fn(async () => undefined),
      appendFailedEvent: vi.fn(async () => undefined),
      now: () => '2026-05-09T12:05:00.000Z',
    });

    const write = writer.markSucceeded({
      job: baseJob,
      attempts: 2,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'worker-a',
      result: undefined,
    });
    expect(updateJobState).toHaveBeenCalledOnce();
    expect(appendSucceededEvent).toHaveBeenCalledOnce();
    finishUpdate?.();
    await write;
  });

  it('preserves the distinct failed event payloads for execution and missing handler', async () => {
    const persistTerminalState = vi.fn(async () => undefined);
    const writer = createJobStateWriter({
      updateJobState: vi.fn(async () => undefined),
      appendStartedEvent: vi.fn(async () => undefined),
      appendSucceededEvent: vi.fn(async () => undefined),
      appendRetriedEvent: vi.fn(async () => undefined),
      appendFailedEvent: vi.fn(async () => undefined),
      persistTerminalState,
      now: () => '2026-05-09T12:05:00.000Z',
    });
    const input = {
      job: baseJob,
      attempts: 5,
      startedAt: '2026-05-09T12:01:00.000Z',
      workerId: 'worker-a',
      errorPayload: {
        code: 'failed',
        category: 'permanent' as const,
        message: 'Failure',
        details: { host: { requestId: 'request-1' }, plugin: { operation: 'import' } },
      },
    };

    await writer.markRetriedOrFailed({ ...input, finalFailure: true });
    await writer.markMissingHandler(input);

    expect(persistTerminalState).toHaveBeenCalledTimes(2);
    expect(persistTerminalState.mock.calls[0]?.[0].event.details).toEqual({
      host: {
        requestId: 'request-1',
        workerId: 'worker-a',
        errorCode: 'failed',
        errorCategory: 'permanent',
      },
      plugin: { operation: 'import' },
    });
    expect(persistTerminalState.mock.calls[1]?.[0].event.details).toEqual({
      host: {
        requestId: 'request-1',
        workerId: 'worker-a',
        errorCode: 'failed',
        errorCategory: 'permanent',
      },
    });
  });
});
