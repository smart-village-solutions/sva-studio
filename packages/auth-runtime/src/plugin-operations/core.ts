import { randomUUID } from 'node:crypto';

import type { StudioJobStartRequest } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import { asApiItem, createApiError, parseRequestBody, readPathSegment, requireIdempotencyKey } from '../shared/request-helpers.js';
import { withAuthenticatedUser } from '../middleware.js';
import { withStudioJobRepository } from './repository.js';
import { queuePluginOperationJob } from './runner.js';

const startPluginOperationJobSchema = z.object({
  pluginId: z.string().trim().min(1),
  jobTypeId: z.string().trim().min(1),
  importProfileId: z.string().trim().min(1).optional(),
  input: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<StudioJobStartRequest>;

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const requireActorInstanceId = (instanceId: string | null | undefined): string | Response =>
  instanceId && instanceId.trim().length > 0
    ? instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getRequestId());

export const startPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const idempotency = requireIdempotencyKey(request, getRequestId());
    if ('error' in idempotency) {
      return idempotency.error;
    }

    const parsed = await parseRequestBody(request, startPluginOperationJobSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, getRequestId());
    }

    try {
      const job = await withStudioJobRepository(instanceId, (repository) =>
        repository.createJob({
          id: randomUUID(),
          instanceId,
          pluginId: parsed.data.pluginId,
          jobTypeId: parsed.data.jobTypeId,
          importProfileId: parsed.data.importProfileId,
          queueName: 'plugin-operations',
          status: 'queued',
          progress: { completedSteps: 0, totalSteps: 1 },
          inputPayload: parsed.data.input,
          attempts: 0,
          maxAttempts: 5,
          idempotencyKey: idempotency.key,
          requestId: getRequestId(),
          actorAccountId: ctx.user.id,
          scheduledAt: new Date().toISOString(),
        })
      );

      try {
        await queuePluginOperationJob({
          instanceId,
          jobId: job.id,
          queueName: job.queueName,
          maxAttempts: job.maxAttempts,
        });
      } catch {
        await withStudioJobRepository(instanceId, (repository) =>
          repository.updateJobState({
            jobId: job.id,
            instanceId,
            status: 'failed',
            attempts: job.attempts,
            startedAt: job.startedAt,
            finishedAt: new Date().toISOString(),
            progress: job.progress,
            errorPayload: {
              code: 'plugin_operation_enqueue_failed',
              retryable: false,
            },
          })
        ).catch(() => undefined);

        return createApiError(
          503,
          'database_unavailable',
          'Der Plugin-Job konnte nicht in die Host-Queue gestellt werden.',
          getRequestId()
        );
      }

      return new Response(JSON.stringify(asApiItem(job, getRequestId())), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return createApiError(
        503,
        'database_unavailable',
        'Der Plugin-Job konnte nicht angelegt werden.',
        getRequestId()
      );
    }
  });

export const getPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const jobId = readPathSegment(request, 4);
    if (!jobId) {
      return createApiError(400, 'invalid_request', 'Job-ID fehlt.', getRequestId());
    }

    try {
      const job = await withStudioJobRepository(instanceId, (repository) => repository.getJobById(instanceId, jobId));
      if (!job) {
        return createApiError(404, 'not_found', 'Job wurde nicht gefunden.', getRequestId());
      }

      return new Response(JSON.stringify(asApiItem(job, getRequestId())), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return createApiError(
        503,
        'database_unavailable',
        'Der Plugin-Job konnte nicht geladen werden.',
        getRequestId()
      );
    }
  });
