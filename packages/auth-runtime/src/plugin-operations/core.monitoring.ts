import {
  studioJobContract,
  studioJobListContract,
  type StudioJobListQuery,
} from '@sva/core';
import { createMutationWorkflow, getWorkspaceContext } from '@sva/server-runtime';

import {
  asApiItem, asApiList, createApiError, readPage, readPathSegment,
} from '../shared/request-helpers.js';
import { withAuthenticatedUser } from '../middleware.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { isUuid } from '../shared/input-readers.js';
import { validateCsrf } from '../shared/request-security.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import { createJsonItemResponse } from './core.shared.js';
import { normalizeStudioJobDetail } from './job-detail-read-model.js';
import { normalizeStudioJobListItem } from './job-list-read-model.js';
import { withStudioJobRepository } from './repository.js';

const TERMINAL_JOB_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const MONITORING_READ_ACTION = 'iam.monitoring.read';
const MONITORING_WRITE_ACTION = 'iam.monitoring.write';

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

export const requireActorInstanceId = (instanceId: string | null | undefined): string | Response =>
  instanceId && instanceId.trim().length > 0
    ? instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getRequestId());

export const requireMonitoringAccess = async (
  ctx: AuthenticatedRequestContext,
  action: string
): Promise<Response | null> => {
  const authorization = await authorizeInstancePermissionForUser({ ctx, action });
  return authorization.ok
    ? null
    : createApiError(
        authorization.status,
        toInstancePermissionApiErrorCode(authorization.error),
        'Keine Berechtigung für Plugin-Operations-Monitoring.',
        getRequestId()
      );
};

const readJobId = (request: Request): string | Response => {
  const jobId = readPathSegment(request, 4);
  if (!jobId) return createApiError(400, 'invalid_request', 'Job-ID fehlt.', getRequestId());
  if (!isUuid(jobId)) return createApiError(400, 'invalid_request', 'Job-ID muss eine UUID sein.', getRequestId());
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

const createMonitoringMutationHandler = <TInput>(
  input: {
    readonly parse: (request: Request, requestId?: string) => Promise<TInput | Response>;
    readonly execute: (
      state: Readonly<{
        request: Request;
        context: AuthenticatedRequestContext;
        requestId?: string;
        instanceId: string;
      }>,
      parsed: TInput
    ) => Promise<Response>;
  }
) => {
  const workflow = createMutationWorkflow<
    AuthenticatedRequestContext,
    { readonly requestId?: string; readonly instanceId: string },
    Record<never, never>,
    Record<never, never>,
    TInput,
    Response
  >({
    prepare: ({ context }) => {
      const requestId = getRequestId();
      const instanceId = requireActorInstanceId(context.user.instanceId);
      return instanceId instanceof Response ? instanceId : { requestId, instanceId };
    },
    authorize: async ({ context }) => (await requireMonitoringAccess(context, MONITORING_WRITE_ACTION)) ?? {},
    csrf: ({ request, requestId }) => validateCsrf(request, requestId) ?? undefined,
    parse: ({ request, requestId }) => input.parse(request, requestId),
    execute: async (state) => input.execute(state, state.input),
    mapError: (_error, state) =>
      createApiError(
        503,
        'database_unavailable',
        'Die Mutation für Plugin-Operations konnte nicht abgeschlossen werden.',
        state.requestId
      ),
    respond: (response) => response,
  });

  return (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => workflow(request, ctx);
};

const parseJobId = async (request: Request): Promise<string | Response> => readJobId(request);

export const getPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const authorizationError = await requireMonitoringAccess(ctx, MONITORING_READ_ACTION);
    if (authorizationError) return authorizationError;

    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) return instanceId;

    const jobId = readJobId(request);
    if (jobId instanceof Response) return jobId;

    try {
      const job = await withStudioJobRepository(instanceId, (repository) => repository.getJobDetail(instanceId, jobId));
      return job
        ? createJsonItemResponse(200, normalizeStudioJobDetail(job), getRequestId())
        : createApiError(404, 'not_found', 'Job wurde nicht gefunden.', getRequestId());
    } catch {
      return createApiError(503, 'database_unavailable', 'Der Plugin-Job konnte nicht geladen werden.', getRequestId());
    }
  });

export const deletePluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, (ctx) =>
    createMonitoringMutationHandler({
      parse: async (inputRequest) => parseJobId(inputRequest),
      execute: async ({ instanceId, requestId }, jobId) => {
        try {
          const job = await withStudioJobRepository(instanceId, async (repository) => {
            const existingJob = await repository.getJobDetail(instanceId, jobId);
            if (!existingJob) return null;
            if (!TERMINAL_JOB_STATUSES.has(existingJob.status)) {
              throw new Error('job_not_terminal');
            }
            return repository.deleteJob(instanceId, jobId);
          });
          if (!job) return createApiError(404, 'not_found', 'Job wurde nicht gefunden.', requestId);
          return createJsonItemResponse(200, job, requestId);
        } catch (error) {
          if (error instanceof Error && error.message === 'job_not_terminal') {
            return createApiError(
              409,
              'conflict',
              'Der Plugin-Job kann erst nach Abschluss oder Abbruch gelöscht werden.',
              requestId
            );
          }
          return createApiError(503, 'database_unavailable', 'Der Plugin-Job konnte nicht gelöscht werden.', requestId);
        }
      },
    })(request, ctx)
  );

export const listPluginOperationJobsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const authorizationError = await requireMonitoringAccess(ctx, MONITORING_READ_ACTION);
    if (authorizationError) return authorizationError;

    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) return instanceId;

    const query = readJobListQuery(request);
    if (query instanceof Response) return query;

    try {
      const jobs = await withStudioJobRepository(instanceId, (repository) => repository.listJobs(instanceId, query));
      return new Response(
        JSON.stringify(
          asApiList(
            jobs.items.map((job) => normalizeStudioJobListItem(job)),
            { page: query.page, pageSize: query.pageSize, total: jobs.total },
            getRequestId()
          )
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return createApiError(503, 'database_unavailable', 'Die Plugin-Jobliste konnte nicht geladen werden.', getRequestId());
    }
  });

export const cancelPluginOperationJobHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, (ctx) =>
    createMonitoringMutationHandler({
      parse: async (inputRequest) => parseJobId(inputRequest),
      execute: async ({ instanceId, requestId }, jobId) => {
        try {
          const job = await withStudioJobRepository(instanceId, (repository) =>
            repository.requestJobCancellation({
              jobId,
              instanceId,
              cancelRequestedAt: new Date().toISOString(),
            })
          );
          if (!job) return createApiError(404, 'not_found', 'Job wurde nicht gefunden.', requestId);
          return new Response(JSON.stringify(asApiItem(job, requestId)), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          return createApiError(
            503,
            'database_unavailable',
            'Die Abbruchanfrage fuer den Plugin-Job konnte nicht gespeichert werden.',
            requestId
          );
        }
      },
    })(request, ctx)
  );
