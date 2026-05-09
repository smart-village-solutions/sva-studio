import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryState = vi.hoisted(() => ({
  withStudioJobRepository: vi.fn(),
}));

vi.mock('./repository.js', () => ({
  withStudioJobRepository: repositoryState.withStudioJobRepository,
}));

import {
  createPluginOperationTaskList,
  registerPluginOperationExecutionHandlers,
  pluginOperationTaskIdentifier,
} from './runner.js';

const baseJob = {
  id: 'job-1',
  instanceId: 'tenant-a',
  pluginId: 'news',
  jobTypeId: 'news.import-articles',
  importProfileId: 'news.article-import',
  queueName: 'plugin-operations',
  status: 'queued',
  progress: { completedSteps: 0, totalSteps: 1 },
  inputPayload: { source: 'upload-1' },
  attempts: 0,
  maxAttempts: 5,
  idempotencyKey: 'idem-1',
  requestId: 'req-1',
  actorAccountId: 'user-1',
  scheduledAt: '2026-05-09T12:00:00.000Z',
  createdAt: '2026-05-09T12:00:00.000Z',
  updatedAt: '2026-05-09T12:00:00.000Z',
};

describe('plugin operation runner task list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPluginOperationExecutionHandlers({});
  });

  it('marks a job as succeeded when a registered handler completes', async () => {
    const updateJobState = vi.fn(async () => null);
    const updateJobProgress = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    repositoryState.withStudioJobRepository
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          getJobById: vi.fn(async () => baseJob),
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobProgress,
          appendJobEvent,
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      );

    const handler = vi.fn(async ({ job, progressReporter, requestId, actorAccountId, abortSignal }) => {
      expect(job).toEqual(baseJob);
      expect(requestId).toBe('req-1');
      expect(actorAccountId).toBe('user-1');
      expect(abortSignal.aborted).toBe(false);
      await progressReporter.reportProgress({
        jobId: 'job-1',
        instanceId: 'tenant-a',
        progress: {
          completedSteps: 1,
          totalSteps: 1,
          currentPhase: 'mapping',
          currentStepKey: 'persist-content',
        },
      });

      return {
        progress: { completedSteps: 1, totalSteps: 1, currentPhase: 'completed' },
        resultPayload: { acceptedRows: 3 },
      };
    });
    registerPluginOperationExecutionHandlers({
      'news.import-articles': handler,
    });

    const taskList = createPluginOperationTaskList(() => new Map([['news.import-articles', handler]]));

    await taskList[pluginOperationTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: 'job-1' },
      {
        job: { attempts: 1, max_attempts: 5 },
      } as never
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        job: baseJob,
        progressReporter: expect.objectContaining({
          reportProgress: expect.any(Function),
        }),
      })
    );
    expect(updateJobState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'running',
        attempts: 1,
        workerId: expect.stringContaining('graphile-worker'),
        heartbeatAt: expect.any(String),
      })
    );
    expect(updateJobProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        progress: expect.objectContaining({
          currentStepKey: 'persist-content',
        }),
      })
    );
    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'succeeded',
        resultPayload: { acceptedRows: 3 },
      })
    );
    expect(appendJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.progressed',
      })
    );
  });

  it('marks a job as failed without retry when no handler is registered', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    repositoryState.withStudioJobRepository
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          getJobById: vi.fn(async () => baseJob),
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      );

    const taskList = createPluginOperationTaskList(() => new Map());

    await taskList[pluginOperationTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: 'job-1' },
      {
        job: { attempts: 1, max_attempts: 5 },
      } as never
    );

    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'failed',
        errorPayload: expect.objectContaining({
          code: 'plugin_operation_handler_missing',
          category: 'permanent',
        }),
      })
    );
  });

  it('marks a job as retrying and rethrows while attempts remain', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    repositoryState.withStudioJobRepository
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          getJobById: vi.fn(async () => baseJob),
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      );

    const handler = vi.fn(async () => {
      throw new Error('boom');
    });

    const taskList = createPluginOperationTaskList(() => new Map([['news.import-articles', handler]]));

    await expect(
      taskList[pluginOperationTaskIdentifier]?.(
        { instanceId: 'tenant-a', jobId: 'job-1' },
        {
          job: { attempts: 1, max_attempts: 5 },
        } as never
      )
    ).rejects.toThrow('boom');

    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'retrying',
        errorPayload: expect.objectContaining({
          code: 'plugin_operation_execution_failed',
          category: 'retryable',
        }),
      })
    );
  });

  it('marks a job as failed on the final attempt without rethrowing', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    repositoryState.withStudioJobRepository
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          getJobById: vi.fn(async () => baseJob),
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      )
      .mockImplementationOnce(async (_instanceId, work) =>
        work({
          updateJobState,
          appendJobEvent,
        })
      );

    const handler = vi.fn(async () => {
      throw new Error('boom');
    });

    const taskList = createPluginOperationTaskList(() => new Map([['news.import-articles', handler]]));

    await expect(
      taskList[pluginOperationTaskIdentifier]?.(
        { instanceId: 'tenant-a', jobId: 'job-1' },
        {
          job: { attempts: 5, max_attempts: 5 },
        } as never
      )
    ).resolves.toBeUndefined();

    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'failed',
        errorPayload: expect.objectContaining({
          code: 'plugin_operation_execution_failed',
          category: 'permanent',
        }),
      })
    );
  });
});
