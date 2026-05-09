import { randomUUID } from 'node:crypto';

import { studioJobContract, studioJobListContract, type StudioJobListQuery, type StudioJobStartRequest } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  asApiList,
  asApiItem,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
} from '../shared/request-helpers.js';
import { withAuthenticatedUser } from '../middleware.js';
import { isUuid } from '../shared/input-readers.js';
import { normalizeStudioJobDetail } from './job-detail-read-model.js';
import { normalizeStudioJobListItem } from './job-list-read-model.js';
import { withStudioJobRepository } from './repository.js';
import { queuePluginOperationJob } from './runner.js';

const MONITORING_ADMIN_ROLES = new Set(['system_admin']);

const startPluginOperationJobSchema = z.object({
  pluginId: z.string().trim().min(1),
  jobTypeId: z.string().trim().min(1),
  importProfileId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
  parentJobId: z.string().trim().uuid().optional(),
  input: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<StudioJobStartRequest>;

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const requireActorInstanceId = (instanceId: string | null | undefined): string | Response =>
  instanceId && instanceId.trim().length > 0
    ? instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getRequestId());

const requireMonitoringAdminRole = (roles: readonly string[]): Response | null =>
  roles.some((role) => MONITORING_ADMIN_ROLES.has(role))
    ? null
    : createApiError(403, 'forbidden', 'Keine Berechtigung für Plugin-Operations-Monitoring.', getRequestId());

const readJobId = (request: Request): string | Response => {
  const jobId = readPathSegment(request, 4);
  if (!jobId) {
    return createApiError(400, 'invalid_request', 'Job-ID fehlt.', getRequestId());
  }

  if (!isUuid(jobId)) {
    return createApiError(400, 'invalid_request', 'Job-ID muss eine UUID sein.', getRequestId());
  }

  return jobId;
};

const readJobListQuery = (request: Request): StudioJobListQuery | Response => {
  const url = new URL(request.url);
  const pagination = readPage(request);
  const viewParam = url.searchParams.get('view');
  const statusParam = url.searchParams.get('status');
  const pluginId = url.searchParams.get('pluginId')?.trim() || undefined;
  const jobTypeId = url.searchParams.get('jobTypeId')?.trim() || undefined;
  const q = url.searchParams.get('q')?.trim() || undefined;

  const view = viewParam && studioJobListContract.isView(viewParam) ? viewParam : 'active';

  if (statusParam && !studioJobContract.isStatus(statusParam)) {
    return createApiError(400, 'invalid_request', 'Unbekannter Job-Statusfilter.', getRequestId());
  }

  const status = statusParam && studioJobContract.isStatus(statusParam) ? statusParam : undefined;

  return {
    view,
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...(status ? { status } : {}),
    ...(pluginId ? { pluginId } : {}),
    ...(jobTypeId ? { jobTypeId } : {}),
    ...(q ? { q } : {}),
  };
};

export const startPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const authorizationError = requireMonitoringAdminRole(ctx.user.roles);
    if (authorizationError) {
      return authorizationError;
    }

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
      const job = await withStudioJobRepository(instanceId, async (repository) => {
        const createdJob = await repository.createJob({
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
          correlationId: parsed.data.correlationId,
          parentJobId: parsed.data.parentJobId,
          scheduledAt: new Date().toISOString(),
        });

        await repository.appendJobEvent({
          id: randomUUID(),
          jobId: createdJob.id,
          instanceId,
          eventType: 'job.queued',
          status: 'queued',
          progress: {
            completedSteps: 0,
            totalSteps: 1,
          },
          attempts: 0,
        });

        return createdJob;
      });

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
              category: 'permanent',
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
    const authorizationError = requireMonitoringAdminRole(ctx.user.roles);
    if (authorizationError) {
      return authorizationError;
    }

    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const jobId = readJobId(request);
    if (jobId instanceof Response) {
      return jobId;
    }

    try {
      const job = await withStudioJobRepository(instanceId, (repository) => repository.getJobDetail(instanceId, jobId));
      if (!job) {
        return createApiError(404, 'not_found', 'Job wurde nicht gefunden.', getRequestId());
      }

      return new Response(JSON.stringify(asApiItem(normalizeStudioJobDetail(job), getRequestId())), {
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

export const listPluginOperationJobsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const authorizationError = requireMonitoringAdminRole(ctx.user.roles);
    if (authorizationError) {
      return authorizationError;
    }

    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const query = readJobListQuery(request);
    if (query instanceof Response) {
      return query;
    }

    try {
      const jobs = await withStudioJobRepository(instanceId, (repository) => repository.listJobs(instanceId, query));

      return new Response(
        JSON.stringify(
          asApiList(
            jobs.items.map((job) => normalizeStudioJobListItem(job)),
            {
              page: query.page,
              pageSize: query.pageSize,
              total: jobs.total,
            },
            getRequestId()
          )
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch {
      return createApiError(
        503,
        'database_unavailable',
        'Die Plugin-Jobliste konnte nicht geladen werden.',
        getRequestId()
      );
    }
  });

export const cancelPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const authorizationError = requireMonitoringAdminRole(ctx.user.roles);
    if (authorizationError) {
      return authorizationError;
    }

    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const jobId = readJobId(request);
    if (jobId instanceof Response) {
      return jobId;
    }

    try {
      const job = await withStudioJobRepository(instanceId, (repository) =>
        repository.requestJobCancellation({
          jobId,
          instanceId,
          cancelRequestedAt: new Date().toISOString(),
        })
      );
      if (!job) {
        return createApiError(404, 'not_found', 'Job wurde nicht gefunden.', getRequestId());
      }

      return new Response(JSON.stringify(asApiItem(job, getRequestId())), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return createApiError(
        503,
        'database_unavailable',
        'Die Abbruchanfrage fuer den Plugin-Job konnte nicht gespeichert werden.',
        getRequestId()
      );
    }
  });
