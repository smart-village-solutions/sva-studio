import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryState = vi.hoisted(() => ({
  withStudioJobRepository: vi.fn(),
}));

const runnerState = vi.hoisted(() => ({
  queuePluginOperationJob: vi.fn(),
  getRegisteredPluginOperationExecutionRegistry: vi.fn(),
}));

const middlewareState = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeInstancePermissionForUser: vi.fn(),
}));

const workspaceContextState = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-test' })),
}));

const idempotencyState = vi.hoisted(() => ({
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
}));

vi.mock('@sva/server-runtime', async () => {
  const actual = await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  return {
    ...actual,
    getWorkspaceContext: workspaceContextState.getWorkspaceContext,
  };
});

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: middlewareState.withAuthenticatedUser,
}));

vi.mock('./repository.js', () => ({
  withStudioJobRepository: repositoryState.withStudioJobRepository,
}));

vi.mock('./runner.js', () => ({
  queuePluginOperationJob: runnerState.queuePluginOperationJob,
  getRegisteredPluginOperationExecutionRegistry: runnerState.getRegisteredPluginOperationExecutionRegistry,
}));

vi.mock('../iam-account-management/shared.js', () => ({
  reserveIdempotency: idempotencyState.reserveIdempotency,
  completeIdempotency: idempotencyState.completeIdempotency,
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: middlewareState.authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode: (error: string) =>
    error === 'missing_instance'
      ? 'invalid_instance_id'
      : error === 'invalid_action'
        ? 'invalid_request'
        : error === 'database_unavailable'
          ? 'database_unavailable'
          : 'forbidden',
}));

import {
  cancelPluginOperationJobHandler,
  deletePluginOperationJobHandler,
  getPluginOperationJobHandler,
  listPluginOperationJobsHandler,
  startPluginOperationJobHandler,
} from './core.js';

describe('plugin operations handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:02:00.000Z'));
    runnerState.queuePluginOperationJob.mockResolvedValue(undefined);
    runnerState.getRegisteredPluginOperationExecutionRegistry.mockReturnValue(
      new Map([
        [
          'news.import-articles',
          {
            handler: vi.fn(),
            queueName: 'plugin-imports',
          },
        ],
      ])
    );
    idempotencyState.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    idempotencyState.completeIdempotency.mockResolvedValue(undefined);
    middlewareState.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        user: {
          id: 'user-1',
          instanceId: 'tenant-a',
          roles: ['custom_role'],
        },
      })
    );
    middlewareState.authorizeInstancePermissionForUser.mockResolvedValue({ ok: true, permissions: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a generic plugin operation job and returns 202', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        createJob: vi.fn(async (input) => ({
          ...input,
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:00:00.000Z',
        })),
        appendJobEvent: vi.fn(async () => null),
      })
    );

    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          importProfileId: 'news.article-import',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(202);
    expect(idempotencyState.reserveIdempotency).toHaveBeenCalledWith({
      actorAccountId: 'user-1',
      endpoint: 'POST:/api/v1/plugin-operations/jobs',
      idempotencyKey: 'idem-1',
      instanceId: 'tenant-a',
      payloadHash: expect.any(String),
    });
    expect(runnerState.queuePluginOperationJob).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      jobId: expect.any(String),
      queueName: 'plugin-imports',
      maxAttempts: 5,
    });
    await expect(response.json()).resolves.toMatchObject({
      data: {
        pluginId: 'news',
        jobTypeId: 'news.import-articles',
        status: 'queued',
        requestId: 'req-test',
      },
    });
    expect(idempotencyState.completeIdempotency).toHaveBeenCalledWith({
      actorAccountId: 'user-1',
      endpoint: 'POST:/api/v1/plugin-operations/jobs',
      idempotencyKey: 'idem-1',
      instanceId: 'tenant-a',
      responseBody: expect.objectContaining({
        data: expect.objectContaining({
          pluginId: 'news',
        }),
        requestId: 'req-test',
      }),
      responseStatus: 202,
      status: 'COMPLETED',
    });
  });

  it('rejects waste-management jobs on the generic endpoint before reserving idempotency', async () => {
    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-waste',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'waste-management',
          jobTypeId: 'waste-management.reset-data',
          input: {
            operation: 'reset-data',
            confirmationToken: 'RESET',
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('dedizierten Waste-Endpunkte'),
      },
    });
    expect(idempotencyState.reserveIdempotency).not.toHaveBeenCalled();
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
  });

  it('returns 503 when queueing into the internal runner fails', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        createJob: vi.fn(async (input) => ({
          ...input,
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:00:00.000Z',
        })),
        appendJobEvent: vi.fn(async () => null),
        updateJobState: vi.fn(async () => null),
      })
    );
    runnerState.queuePluginOperationJob.mockRejectedValueOnce(new Error('queue down'));

    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });
    expect(idempotencyState.completeIdempotency).toHaveBeenCalledWith({
      actorAccountId: 'user-1',
      endpoint: 'POST:/api/v1/plugin-operations/jobs',
      idempotencyKey: 'idem-1',
      instanceId: 'tenant-a',
      responseBody: expect.objectContaining({
        error: expect.objectContaining({
          code: 'database_unavailable',
        }),
      }),
      responseStatus: 503,
      status: 'FAILED',
    });
  });

  it('rejects start requests without csrf protection before touching repositories', async () => {
    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'csrf_validation_failed',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
    expect(idempotencyState.reserveIdempotency).not.toHaveBeenCalled();
  });

  it('replays the stored start response for matching idempotency keys', async () => {
    idempotencyState.reserveIdempotency.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 202,
      responseBody: {
        data: {
          id: 'job-1',
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          status: 'queued',
        },
        requestId: 'req-test',
      },
    });

    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'job-1',
        pluginId: 'news',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
    expect(runnerState.queuePluginOperationJob).not.toHaveBeenCalled();
    expect(idempotencyState.completeIdempotency).not.toHaveBeenCalled();
  });

  it('returns an idempotency conflict for reused keys with a different payload', async () => {
    idempotencyState.reserveIdempotency.mockResolvedValueOnce({
      status: 'conflict',
      message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
    });

    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          input: { source: 'upload-2' },
        }),
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'idempotency_key_reuse',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
    expect(runnerState.queuePluginOperationJob).not.toHaveBeenCalled();
    expect(idempotencyState.completeIdempotency).not.toHaveBeenCalled();
  });

  it('rejects unknown plugin operation job types before creating jobs', async () => {
    runnerState.getRegisteredPluginOperationExecutionRegistry.mockReturnValueOnce(new Map());

    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.unknown-job',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
    expect(runnerState.queuePluginOperationJob).not.toHaveBeenCalled();
  });

  it('reads a job status for the authenticated instance', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        getJobDetail: vi.fn(async () => ({
          id: 'job-1',
          instanceId: 'tenant-a',
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          importProfileId: 'news.article-import',
          queueName: 'plugin-operations',
          status: 'running',
          progress: {
            completedSteps: 1,
            totalSteps: 3,
            currentPhase: 'mapping',
            currentStepKey: 'validate-schema',
            lastUpdatedAt: '2026-05-09T12:01:00.000Z',
          },
          inputPayload: { source: 'upload-1' },
          attempts: 1,
          maxAttempts: 5,
          idempotencyKey: 'idem-1',
          requestId: 'req-test',
          actorAccountId: 'user-1',
          workerId: 'graphile-worker-1',
          heartbeatAt: '2026-05-09T12:01:30.000Z',
          lastProgressAt: '2026-05-09T12:01:00.000Z',
          correlationId: 'corr-1',
          scheduledAt: '2026-05-09T12:00:00.000Z',
          startedAt: '2026-05-09T12:01:00.000Z',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:01:00.000Z',
          history: [
            {
              id: 'event-1',
              jobId: 'job-1',
              instanceId: 'tenant-a',
              eventType: 'job.started',
              status: 'running',
              attempts: 1,
              createdAt: '2026-05-09T12:01:00.000Z',
            },
          ],
        })),
      })
    );

    const response = await getPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/11111111-1111-4111-8111-111111111111', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'job-1',
        status: 'running',
        progress: {
          completedSteps: 1,
          totalSteps: 3,
          currentPhase: 'mapping',
          currentStepKey: 'validate-schema',
          lastUpdatedAt: '2026-05-09T12:01:00.000Z',
        },
        history: [
          {
            id: 'event-1',
            eventType: 'job.started',
          },
        ],
        latestEvent: {
          id: 'event-1',
          eventType: 'job.started',
        },
        runtime: {
          cancellationRequested: false,
          staleState: 'fresh',
          staleAfterSeconds: 120,
          evaluatedAt: expect.any(String),
          lastObservedAt: '2026-05-09T12:01:30.000Z',
        },
      },
    });
  });

  it('lists plugin operation jobs for the authenticated instance', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        listJobs: vi.fn(async () => ({
          total: 1,
          items: [
            {
              id: 'job-1',
              instanceId: 'tenant-a',
              pluginId: 'news',
              jobTypeId: 'news.import-articles',
              queueName: 'plugin-operations',
              status: 'running',
              progress: {
                completedSteps: 1,
                totalSteps: 3,
                currentStepKey: 'validate-schema',
              },
              inputPayload: { source: 'upload-1' },
              attempts: 1,
              maxAttempts: 5,
              idempotencyKey: 'idem-1',
              workerId: 'graphile-worker-1',
              heartbeatAt: '2026-05-09T12:01:30.000Z',
              lastProgressAt: '2026-05-09T12:01:00.000Z',
              correlationId: 'corr-1',
              scheduledAt: '2026-05-09T12:00:00.000Z',
              startedAt: '2026-05-09T12:01:00.000Z',
              createdAt: '2026-05-09T12:00:00.000Z',
              updatedAt: '2026-05-09T12:01:00.000Z',
              latestEvent: {
                id: 'event-1',
                jobId: 'job-1',
                instanceId: 'tenant-a',
                eventType: 'job.progressed',
                status: 'running',
                progress: {
                  completedSteps: 1,
                  totalSteps: 3,
                  currentStepKey: 'validate-schema',
                },
                attempts: 1,
                createdAt: '2026-05-09T12:01:00.000Z',
              },
            },
          ],
        })),
      })
    );

    const response = await listPluginOperationJobsHandler(
      new Request(
        'https://studio.test/api/v1/plugin-operations/jobs?view=active&page=2&pageSize=5&status=running&pluginId=news&jobTypeId=news.import-articles&q=corr',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: 'job-1',
          status: 'running',
          latestEvent: {
            id: 'event-1',
            presentation: {
              title: 'job.progressed',
            },
          },
          runtime: {
            staleState: 'fresh',
          },
        },
      ],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 1,
      },
    });
  });

  it('stores a cancellation request for the authenticated instance', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        requestJobCancellation: vi.fn(async () => ({
          id: 'job-1',
          instanceId: 'tenant-a',
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          queueName: 'plugin-operations',
          status: 'running',
          inputPayload: { source: 'upload-1' },
          attempts: 1,
          maxAttempts: 5,
          idempotencyKey: 'idem-1',
          cancelRequestedAt: '2026-05-09T12:02:00.000Z',
          scheduledAt: '2026-05-09T12:00:00.000Z',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:02:00.000Z',
        })),
      })
    );

    const response = await cancelPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/11111111-1111-4111-8111-111111111111/cancel', {
        method: 'POST',
        headers: {
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'job-1',
        cancelRequestedAt: '2026-05-09T12:02:00.000Z',
      },
    });
  });

  it('deletes a plugin operation job for the authenticated instance', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        getJobDetail: vi.fn(async () => ({
          id: 'job-1',
          status: 'failed',
        })),
        deleteJob: vi.fn(async () => ({
          id: 'job-1',
          instanceId: 'tenant-a',
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          queueName: 'plugin-operations',
          status: 'failed',
          inputPayload: { source: 'upload-1' },
          attempts: 1,
          maxAttempts: 5,
          idempotencyKey: 'idem-1',
          scheduledAt: '2026-05-09T12:00:00.000Z',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:02:00.000Z',
        })),
      })
    );

    const response = await deletePluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/11111111-1111-4111-8111-111111111111', {
        method: 'DELETE',
        headers: {
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'job-1',
        status: 'failed',
      },
    });
  });

  it('rejects deletion of queued or running plugin operation jobs', async () => {
    repositoryState.withStudioJobRepository.mockImplementation(async (_instanceId, work) =>
      work({
        getJobDetail: vi.fn(async () => ({
          id: 'job-1',
          instanceId: 'tenant-a',
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          queueName: 'plugin-operations',
          status: 'running',
          inputPayload: { source: 'upload-1' },
          attempts: 1,
          maxAttempts: 5,
          idempotencyKey: 'idem-1',
          scheduledAt: '2026-05-09T12:00:00.000Z',
          createdAt: '2026-05-09T12:00:00.000Z',
          updatedAt: '2026-05-09T12:02:00.000Z',
        })),
        deleteJob: vi.fn(async () => {
          throw new Error('deleteJob should not be called for active jobs');
        }),
      })
    );

    const response = await deletePluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/11111111-1111-4111-8111-111111111111', {
        method: 'DELETE',
        headers: {
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        message: expect.stringContaining('erst nach Abschluss oder Abbruch gelöscht'),
      },
    });
  });

  it('rejects cancellation requests without csrf protection before touching repositories', async () => {
    const response = await cancelPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/11111111-1111-4111-8111-111111111111/cancel', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'csrf_validation_failed',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
  });

  it('rejects plugin operation access for users without monitoring permissions', async () => {
    middlewareState.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        user: {
          id: 'user-2',
          instanceId: 'tenant-a',
          roles: ['editor'],
        },
      })
    );
    middlewareState.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für Plugin-Operations-Monitoring.',
    });

    const response = await listPluginOperationJobsHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs?view=active', { method: 'GET' })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
  });

  it('rejects invalid parentJobId values before creating jobs', async () => {
    const response = await startPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          pluginId: 'news',
          jobTypeId: 'news.import-articles',
          parentJobId: 'not-a-uuid',
          input: { source: 'upload-1' },
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
  });

  it('rejects invalid job ids in detail routes before querying the repository', async () => {
    const response = await getPluginOperationJobHandler(
      new Request('https://studio.test/api/v1/plugin-operations/jobs/not-a-uuid', { method: 'GET' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });
    expect(repositoryState.withStudioJobRepository).not.toHaveBeenCalled();
  });

});
