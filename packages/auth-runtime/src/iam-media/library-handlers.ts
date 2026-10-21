import { z } from 'zod';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
} from '../shared/request-helpers.js';
import { validateCsrf } from '../shared/request-security.js';
import { jsonResponse } from '../db.js';
import {
  getMediaInventoryScan,
  inventoryScanOptionsSchema,
  scheduleMediaInventoryScan,
} from './inventory-scan-job.js';
import {
  getMediaRequestId,
  resolveBodyScopedMediaInstanceId,
  resolveScopedMediaInstanceId,
} from './request-context.js';
import {
  emitMediaAuditEvent,
  mapMediaAuthorizationFailure,
  withMediaStorageGuard,
} from './http-support.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { deleteMedia, updateMedia } from './asset-mutation-handlers.js';
import { getMedia, getMediaDelivery, getMediaUsage } from './asset-read-handlers.js';
import { registerBucketMedia } from './asset-registration-handler.js';
import type { MediaHttpHandlerDeps } from './http-support.js';
import { listMedia } from './library-list-handler.js';

const inventoryStartSchema = inventoryScanOptionsSchema.extend({
  instanceId: z.string().trim().min(1).max(256).optional(),
});

const authorizeInventory = async (
  deps: MediaHttpHandlerDeps,
  ctx: AuthenticatedRequestContext,
  instanceId: string
): Promise<Response | null> => {
  for (const action of ['media.read', 'media.update']) {
    const authorization = await deps.authorizeAction({ ctx, instanceId, action });
    if (!authorization.ok) {
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'media.inventoryScan',
        result: 'denied',
        reasonCode: authorization.error,
        resourceType: 'studio_job',
      });
      return mapMediaAuthorizationFailure(authorization);
    }
  }
  return null;
};

const startInventoryScan = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const csrf = validateCsrf(request, getMediaRequestId());
  if (csrf) return csrf;
  const parsed = await parseRequestBody(request, inventoryStartSchema);
  if (!parsed.ok)
    return createApiError(400, 'invalid_request', parsed.message, getMediaRequestId());
  const scope = resolveBodyScopedMediaInstanceId(parsed.data.instanceId, ctx.user.instanceId);
  if (!scope.ok) return scope.response;
  const denied = await authorizeInventory(deps, ctx, scope.instanceId);
  if (denied) return denied;
  return withMediaStorageGuard(
    async () => {
      const job = await (deps.scheduleInventoryScan ?? scheduleMediaInventoryScan)({
        instanceId: scope.instanceId,
        jobId: deps.createId(),
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
        requestId: getMediaRequestId(),
      });
      await emitMediaAuditEvent({
        deps,
        ctx,
        instanceId: scope.instanceId,
        actionId: 'media.inventoryScanStarted',
        result: 'success',
        resourceType: 'studio_job',
        resourceId: job.id,
      });
      return jsonResponse(202, asApiItem(job, getMediaRequestId()));
    },
    {
      deps,
      ctx,
      instanceId: scope.instanceId,
      actionId: 'media.inventoryScanStarted',
      resourceType: 'studio_job',
    }
  );
};

const getInventoryScan = async (
  deps: MediaHttpHandlerDeps,
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const scope = resolveScopedMediaInstanceId(request, ctx.user.instanceId);
  if (scope instanceof Response) return scope;
  const jobId = z.string().uuid().safeParse(readPathSegment(request, 5));
  if (!jobId.success)
    return createApiError(400, 'invalid_request', 'Ungültige Scan-ID.', getMediaRequestId());
  const denied = await authorizeInventory(deps, ctx, scope);
  if (denied) return denied;
  return withMediaStorageGuard(
    async () => {
      const job = await (deps.getInventoryScan ?? getMediaInventoryScan)(scope, jobId.data);
      if (!job)
        return createApiError(
          404,
          'not_found',
          'Bestandsscan nicht gefunden.',
          getMediaRequestId()
        );
      return jsonResponse(200, asApiItem(job, getMediaRequestId()));
    },
    {
      deps,
      ctx,
      instanceId: scope,
      actionId: 'media.inventoryScanRead',
      resourceType: 'studio_job',
      resourceId: jobId.data,
    }
  );
};

export const createMediaLibraryHandlers = (deps: MediaHttpHandlerDeps) => ({
  startInventoryScan: (request: Request, ctx: AuthenticatedRequestContext) =>
    startInventoryScan(deps, request, ctx),
  getInventoryScan: (request: Request, ctx: AuthenticatedRequestContext) =>
    getInventoryScan(deps, request, ctx),
  listMedia: (request: Request, ctx: AuthenticatedRequestContext) => listMedia(deps, request, ctx),
  getMedia: (request: Request, ctx: AuthenticatedRequestContext) => getMedia(deps, request, ctx),
  getMediaUsage: (request: Request, ctx: AuthenticatedRequestContext) =>
    getMediaUsage(deps, request, ctx),
  registerBucketMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    registerBucketMedia(deps, request, ctx),
  updateMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    updateMedia(deps, request, ctx),
  getMediaDelivery: (request: Request, ctx: AuthenticatedRequestContext) =>
    getMediaDelivery(deps, request, ctx),
  deleteMedia: (request: Request, ctx: AuthenticatedRequestContext) =>
    deleteMedia(deps, request, ctx),
});
