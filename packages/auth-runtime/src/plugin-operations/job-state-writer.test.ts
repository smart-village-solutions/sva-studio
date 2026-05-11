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
});
