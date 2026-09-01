import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioJobRepository } from '@sva/data-repositories';
import type { StudioJobRecord } from '@sva/core';

const repositoryState = vi.hoisted(() => ({
  withStudioJobRepository: vi.fn(),
  withPluginTenantLifecycleRepository: vi.fn(),
  withStudioJobLifecycleRepositories: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const pluginAccessState = vi.hoisted(() => ({
  isEffectivelyActive: vi.fn(async () => true),
  isLifecycleJobType: vi.fn(() => false),
  readAccess: vi.fn(async () => ({ allowed: true as const, reason: 'ready' as const })),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  createSdkLogger: () => repositoryState.logger,
}));

vi.mock('./repository.js', () => ({
  withStudioJobRepository: repositoryState.withStudioJobRepository,
  withPluginTenantLifecycleRepository: repositoryState.withPluginTenantLifecycleRepository,
  withStudioJobLifecycleRepositories: repositoryState.withStudioJobLifecycleRepositories,
}));

vi.mock('../plugin-tenant-lifecycle/access.js', () => ({
  isConfiguredPluginTenantEffectivelyActive: pluginAccessState.isEffectivelyActive,
  isConfiguredPluginTenantLifecycleJobType: pluginAccessState.isLifecycleJobType,
  readConfiguredPluginTenantAccess: pluginAccessState.readAccess,
}));

import {
  createPluginOperationTaskList,
  registerPluginOperationExecutionHandlers,
  studioJobTaskIdentifier,
} from './runner.js';

const baseJob: StudioJobRecord = {
  id: 'job-1',
  instanceId: 'tenant-a',
  source: 'plugin',
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

type RepositoryDoubleOptions = {
  readonly job?: StudioJobRecord;
  readonly getJobById?: (currentJob: StudioJobRecord) => Promise<StudioJobRecord | null>;
  readonly updateJobState?: ReturnType<typeof vi.fn>;
  readonly updateJobProgress?: ReturnType<typeof vi.fn>;
  readonly appendJobEvent?: ReturnType<typeof vi.fn>;
};

const installStudioJobRepositoryDouble = (options: RepositoryDoubleOptions = {}) => {
  let currentJob = options.job ?? baseJob;
  const terminalEvents = new Map<string, Parameters<StudioJobRepository['appendJobEvent']>[0]>();
  const updateJobState = options.updateJobState ?? vi.fn(async () => null);
  const updateJobProgress = options.updateJobProgress ?? vi.fn(async () => null);
  const appendJobEvent = options.appendJobEvent ?? vi.fn(async () => null);

  const readCurrentJob = async () => {
    const resolved = options.getJobById ? await options.getJobById(currentJob) : currentJob;
    if (resolved) currentJob = resolved;
    return resolved;
  };
  const applyUpdate = (
    input: Parameters<StudioJobRepository['updateJobState']>[0]
  ): StudioJobRecord => {
    const { jobId, instanceId, ...changes } = input;
    return { ...currentJob, ...changes, id: jobId, instanceId };
  };
  const matchesFence = (input: Parameters<StudioJobRepository['transitionJobState']>[0]) =>
    input.expectedStatuses.includes(currentJob.status) &&
    input.expectedAttempts === currentJob.attempts &&
    input.expectedWorkerId === (currentJob.workerId ?? null);

  const transitionJobState = vi.fn(
    async (input: Parameters<StudioJobRepository['transitionJobState']>[0]) => {
      if (!matchesFence(input)) return { outcome: 'conflict' as const, job: currentJob };
      const {
        expectedStatuses: _expectedStatuses,
        expectedAttempts: _expectedAttempts,
        expectedWorkerId: _expectedWorkerId,
        ...update
      } = input;
      await updateJobState(update);
      currentJob = applyUpdate(update);
      return { outcome: 'applied' as const, job: currentJob };
    }
  );
  const transitionJobStateAndAppendEvent = vi.fn(
    async (input: Parameters<StudioJobRepository['transitionJobStateAndAppendEvent']>[0]) => {
      const terminalEventKey = `${input.jobId}:${input.event.attempts}`;
      const existingEvent = terminalEvents.get(terminalEventKey);
      if (
        existingEvent?.eventType === input.event.eventType &&
        currentJob.status === input.status
      ) {
        return { outcome: 'alreadyApplied' as const, job: currentJob };
      }
      if (!matchesFence(input)) return { outcome: 'conflict' as const, job: currentJob };
      const {
        expectedStatuses: _expectedStatuses,
        expectedAttempts: _expectedAttempts,
        expectedWorkerId: _expectedWorkerId,
        leasePredicate: _leasePredicate,
        event,
        ...update
      } = input;

      // Both effects are awaited before the in-memory commit so a rejected write
      // cannot leave the double with a one-sided terminal state.
      await updateJobState(update);
      await appendJobEvent(event);
      currentJob = applyUpdate(update);
      terminalEvents.set(terminalEventKey, event);
      return { outcome: 'applied' as const, job: currentJob };
    }
  );
  const updateJobProgressWithLease = vi.fn(
    async (input: Parameters<StudioJobRepository['updateJobProgressWithLease']>[0]) => {
      if (input.attempts !== currentJob.attempts || input.workerId !== currentJob.workerId) {
        return null;
      }
      await updateJobProgress(input);
      currentJob = { ...currentJob, progress: input.progress };
      return currentJob;
    }
  );

  const repository = {
    getJobById: vi.fn(readCurrentJob),
    updateJobState,
    transitionJobState,
    transitionJobStateAndAppendEvent,
    updateJobProgress,
    updateJobProgressWithLease,
    appendJobEvent,
  };
  repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
    work(repository)
  );
  repositoryState.withStudioJobLifecycleRepositories.mockImplementation(async (_instanceId, work) =>
    work({
      studioJobs: repository,
      tenantLifecycle: {},
      enqueuePluginTenantLifecycleRetry: vi.fn(async () => undefined),
    })
  );

  return { repository, terminalEvents, getCurrentJob: () => currentJob };
};

describe('plugin operation runner task list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginAccessState.isEffectivelyActive.mockResolvedValue(true);
    pluginAccessState.isLifecycleJobType.mockReturnValue(false);
    pluginAccessState.readAccess.mockResolvedValue({ allowed: true, reason: 'ready' });
    registerPluginOperationExecutionHandlers({});
  });

  it('marks a job as succeeded when a registered handler completes', async () => {
    const updateJobState = vi.fn(async () => null);
    const updateJobProgress = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    const { repository, terminalEvents } = installStudioJobRepositoryDouble({
      updateJobState,
      updateJobProgress,
      appendJobEvent,
    });

    const handler = vi.fn(
      async ({
        job,
        progressReporter,
        requestId,
        actorAccountId,
        abortSignal,
        throwIfCancellationRequested,
      }) => {
        expect(job).toEqual(baseJob);
        expect(job.instanceId).toBe('tenant-a');
        expect(requestId).toBe('req-1');
        expect(actorAccountId).toBe('user-1');
        expect(progressReporter).toBeDefined();
        expect(abortSignal.aborted).toBe(false);
        await expect(throwIfCancellationRequested()).resolves.toBeUndefined();
        await progressReporter.reportProgress({
          progress: {
            completedSteps: 1,
            totalSteps: 1,
            currentPhase: 'mapping',
            currentStepKey: 'persist-content',
          },
        });

        return {
          progress: { completedSteps: 1, totalSteps: 1, currentPhase: 'completed' },
          resultPayload: {
            summary: {
              acceptedItems: 3,
            },
            plugin: {
              acceptedRows: 3,
            },
          },
        };
      }
    );
    registerPluginOperationExecutionHandlers({
      'news.import-articles': handler,
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 1, max_attempts: 5 },
    } as never);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'job',
        pluginId: 'news',
        instanceId: 'tenant-a',
        capabilities: {
          requestContext: true,
          auditReporter: false,
          progressReporter: true,
          secretAccess: false,
        },
        job: baseJob,
        progressReporter: expect.objectContaining({
          reportProgress: expect.any(Function),
        }),
        throwIfCancellationRequested: expect.any(Function),
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
    expect(appendJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.progressed',
        details: {
          host: {
            workerId: expect.stringContaining('graphile-worker'),
          },
        },
      })
    );
    expect(repository.transitionJobState).toHaveBeenCalledWith(
      expect.objectContaining({ expectedStatuses: ['queued'], expectedAttempts: 0 })
    );
    expect(repository.transitionJobStateAndAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatuses: ['running'],
        expectedAttempts: 1,
        event: expect.objectContaining({ eventType: 'job.succeeded' }),
      })
    );
    expect(terminalEvents.size).toBe(1);
  });

  it('keeps the repository double fenced and terminal writes idempotent', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    const { repository, terminalEvents, getCurrentJob } = installStudioJobRepositoryDouble({
      updateJobState,
      appendJobEvent,
    });
    const runningInput = {
      jobId: 'job-1',
      instanceId: 'tenant-a',
      status: 'running' as const,
      attempts: 1,
      workerId: 'worker-1',
      expectedStatuses: ['queued'] as const,
      expectedAttempts: 0,
      expectedWorkerId: null,
    };

    await expect(repository.transitionJobState(runningInput)).resolves.toMatchObject({
      outcome: 'applied',
    });
    await expect(repository.transitionJobState(runningInput)).resolves.toMatchObject({
      outcome: 'conflict',
    });

    const terminalInput = {
      jobId: 'job-1',
      instanceId: 'tenant-a',
      status: 'succeeded' as const,
      attempts: 1,
      workerId: 'worker-1',
      expectedStatuses: ['running'] as const,
      expectedAttempts: 1,
      expectedWorkerId: 'worker-1',
      leasePredicate: { kind: 'activeOwner' as const },
      event: {
        id: 'event-1',
        jobId: 'job-1',
        instanceId: 'tenant-a',
        eventType: 'job.succeeded' as const,
        status: 'succeeded' as const,
        attempts: 1,
      },
    };
    await expect(repository.transitionJobStateAndAppendEvent(terminalInput)).resolves.toMatchObject(
      { outcome: 'applied' }
    );
    await expect(repository.transitionJobStateAndAppendEvent(terminalInput)).resolves.toMatchObject(
      { outcome: 'alreadyApplied' }
    );

    expect(getCurrentJob().status).toBe('succeeded');
    expect(updateJobState).toHaveBeenCalledTimes(2);
    expect(appendJobEvent).toHaveBeenCalledOnce();
    expect(terminalEvents.size).toBe(1);
  });

  it('marks a job as failed without retry when no handler is registered', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    installStudioJobRepositoryDouble({ updateJobState, appendJobEvent });

    const taskList = createPluginOperationTaskList(() => new Map());

    await taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 1, max_attempts: 5 },
    } as never);

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

  it('fails a queued plugin job before handler execution when tenant access became blocked', async () => {
    const updateJobState = vi.fn(async () => null);
    installStudioJobRepositoryDouble({ updateJobState });
    pluginAccessState.readAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'blocked',
    });
    const handler = vi.fn(async () => ({}));
    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await expect(
      taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
        job: { attempts: 1, max_attempts: 5 },
      } as never)
    ).resolves.toBeUndefined();

    expect(handler).not.toHaveBeenCalled();
    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: 'failed',
        errorPayload: expect.objectContaining({
          category: 'permanent',
          details: {
            plugin: expect.objectContaining({ code: 'plugin_tenant_access_blocked' }),
          },
        }),
      })
    );
  });

  it('keeps lifecycle repair jobs executable while tenant access is blocked', async () => {
    const lifecycleJob = {
      ...baseJob,
      pluginId: 'waste-management',
      jobTypeId: 'waste-management.provision-tenant-database',
      inputPayload: {
        studioTenantLifecycle: { operation: 'provision', generation: 3 },
      },
    };
    const { repository } = installStudioJobRepositoryDouble({ job: lifecycleJob });
    repositoryState.withPluginTenantLifecycleRepository.mockImplementation(
      async (_instanceId, work) =>
        work({
          getLifecycle: vi.fn(async () => ({
            activeJobId: lifecycleJob.id,
            claimedGeneration: 3,
            desiredOperation: 'provision',
          })),
        })
    );
    repositoryState.withStudioJobLifecycleRepositories.mockImplementation(
      async (_instanceId, work) =>
        work({
          studioJobs: repository,
          tenantLifecycle: {
            completeLifecycle: vi.fn(async () => ({ completedGeneration: 3 })),
            failLifecycle: vi.fn(async () => ({
              retryKind: 'retryable',
              retryAfter: '2999-01-01T00:00:00.000Z',
            })),
          },
          enqueuePluginTenantLifecycleRetry: vi.fn(async () => undefined),
        })
    );
    pluginAccessState.isLifecycleJobType.mockReturnValue(true);
    const handler = vi.fn(async () => ({
      tenantLifecycle: { revision: 'news-v3', checks: [] },
    }));
    const taskList = createPluginOperationTaskList(
      () =>
        new Map([
          [
            'waste-management.provision-tenant-database',
            { handler, queueName: 'plugin-operations' },
          ],
        ])
    );

    await taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 1, max_attempts: 5 },
    } as never);

    expect(handler).toHaveBeenCalledOnce();
    expect(pluginAccessState.isEffectivelyActive).toHaveBeenCalledWith(
      'tenant-a',
      'waste-management'
    );
    expect(pluginAccessState.readAccess).not.toHaveBeenCalled();
  });

  it('blocks a queued lifecycle job when the plugin became inactive', async () => {
    const updateJobState = vi.fn(async () => null);
    const updateLifecycleJobState = vi.fn(async () => null);
    const lifecycleJob = {
      ...baseJob,
      inputPayload: {
        studioTenantLifecycle: { operation: 'provision', generation: 3 },
      },
    };
    const { repository } = installStudioJobRepositoryDouble({ job: lifecycleJob, updateJobState });
    repositoryState.withStudioJobLifecycleRepositories.mockImplementation(
      async (_instanceId, work) =>
        work({
          studioJobs: {
            ...repository,
            transitionJobStateAndAppendEvent: vi.fn(async (input) => {
              const result = await repository.transitionJobStateAndAppendEvent(input);
              await updateLifecycleJobState(input);
              return result;
            }),
          },
          tenantLifecycle: {
            failLifecycle: vi.fn(async () => ({
              retryKind: 'retryable',
              retryAfter: '2999-01-01T00:00:00.000Z',
            })),
          },
          enqueuePluginTenantLifecycleRetry: vi.fn(async () => undefined),
        })
    );
    pluginAccessState.isLifecycleJobType.mockReturnValue(true);
    pluginAccessState.isEffectivelyActive.mockResolvedValueOnce(false);
    const handler = vi.fn(async () => ({}));
    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 1, max_attempts: 5 },
    } as never);

    expect(handler).not.toHaveBeenCalled();
    expect(updateJobState).toHaveBeenCalledTimes(2);
    expect(updateLifecycleJobState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorPayload: expect.objectContaining({
          category: 'permanent',
          details: {
            plugin: expect.objectContaining({ code: 'plugin_tenant_lifecycle_inactive' }),
          },
        }),
      })
    );
  });

  it('marks a job as retrying and rethrows while attempts remain', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    installStudioJobRepositoryDouble({ updateJobState, appendJobEvent });

    const handler = vi.fn(async () => {
      throw new Error('boom');
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await expect(
      taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
        job: { attempts: 1, max_attempts: 5 },
      } as never)
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
    installStudioJobRepositoryDouble({ updateJobState, appendJobEvent });

    const handler = vi.fn(async () => {
      throw new Error('boom');
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await expect(
      taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
        job: { attempts: 5, max_attempts: 5 },
      } as never)
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

  it('logs a secondary failure when persisting the final job failure fails and preserves the rejection', async () => {
    const persistenceError = new TypeError('database write failed');
    const updateJobState = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(persistenceError);
    installStudioJobRepositoryDouble({ updateJobState });
    const handler = vi.fn(async () => {
      throw new Error('primary execution failure');
    });
    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await expect(
      taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
        job: { attempts: 5, max_attempts: 5 },
      } as never)
    ).rejects.toBe(persistenceError);

    expect(repositoryState.logger.error).toHaveBeenCalledWith(
      'plugin_operation_failure_state_persist_failed',
      expect.objectContaining({
        error_code: 'failure_state_persist_failed',
        error_type: 'TypeError',
        result: 'secondary_failure',
        context: {
          job_id: 'job-1',
          execution_id: 'job-1',
          instance_id: 'tenant-a',
        },
      })
    );
  });

  it('marks a job as failed immediately for explicitly permanent execution errors', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    installStudioJobRepositoryDouble({ updateJobState, appendJobEvent });

    const handler = vi.fn(async () => {
      throw new Error('waste_mainserver_sync_not_implemented', {
        cause: {
          category: 'permanent',
          code: 'waste_mainserver_sync_not_implemented',
        },
      });
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await expect(
      taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
        job: { attempts: 1, max_attempts: 5 },
      } as never)
    ).resolves.toBeUndefined();

    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'failed',
        errorPayload: expect.objectContaining({
          code: 'plugin_operation_execution_failed',
          category: 'permanent',
          details: {
            plugin: {
              category: 'permanent',
              code: 'waste_mainserver_sync_not_implemented',
            },
          },
        }),
      })
    );
  });

  it('marks a job as cancelled when the handler cooperatively aborts', async () => {
    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    installStudioJobRepositoryDouble({
      updateJobState,
      appendJobEvent,
      getJobById: vi.fn(async (currentJob: StudioJobRecord) => ({
        ...currentJob,
        cancelRequestedAt: '2026-05-09T12:04:00.000Z',
      })),
    });

    const handler = vi.fn(async ({ throwIfCancellationRequested }) => {
      await throwIfCancellationRequested();
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );

    await taskList[studioJobTaskIdentifier]?.({ instanceId: 'tenant-a', jobId: 'job-1' }, {
      job: { attempts: 2, max_attempts: 5 },
    } as never);

    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'cancelled',
      })
    );
    expect(appendJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'job.cancelled',
      })
    );
  });

  it('aborts the handler signal when cancellation is requested after the job started', async () => {
    vi.useFakeTimers();

    const updateJobState = vi.fn(async () => null);
    const appendJobEvent = vi.fn(async () => null);
    let cancellationRequested = false;
    installStudioJobRepositoryDouble({
      updateJobState,
      appendJobEvent,
      getJobById: vi.fn(async (currentJob: StudioJobRecord) =>
        cancellationRequested
          ? {
              ...currentJob,
              cancelRequestedAt: '2026-05-09T12:04:00.000Z',
            }
          : currentJob
      ),
    });

    const handler = vi.fn(async ({ abortSignal }) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1_500);
      });

      if (abortSignal.aborted) {
        throw new Error('aborted');
      }
    });

    const taskList = createPluginOperationTaskList(
      () => new Map([['news.import-articles', { handler, queueName: 'plugin-operations' }]])
    );
    const runPromise = taskList[studioJobTaskIdentifier]?.(
      { instanceId: 'tenant-a', jobId: 'job-1' },
      {
        job: { attempts: 2, max_attempts: 5 },
      } as never
    );
    const runAssertion = expect(runPromise).rejects.toThrow('aborted');

    cancellationRequested = true;
    await vi.advanceTimersByTimeAsync(1_500);

    await runAssertion;
    expect(updateJobState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: 'job-1',
        status: 'retrying',
      })
    );
  });
});
