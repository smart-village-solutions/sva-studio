import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryState = vi.hoisted(() => ({
  withStudioJobRepository: vi.fn(),
}));

const runnerState = vi.hoisted(() => ({
  queuePluginOperationJob: vi.fn(),
}));

const middlewareState = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
}));

const workspaceContextState = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-test' })),
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
}));

import {
  cancelPluginOperationJobHandler,
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
    middlewareState.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        user: {
          id: 'user-1',
          instanceId: 'tenant-a',
          roles: ['system_admin'],
        },
      })
    );
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
    expect(runnerState.queuePluginOperationJob).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      jobId: expect.any(String),
      queueName: 'plugin-operations',
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
              title: 'Fortschritt aktualisiert',
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

  it('rejects plugin operation access for users without monitoring admin roles', async () => {
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
