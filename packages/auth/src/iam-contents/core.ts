import { summarizeContentAccess, type IamContentAccessSummary } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';

import { asApiItem, asApiList, createApiError, readPathSegment } from '../iam-account-management/api-helpers.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedContentHandler, resolveContentActor } from './request-context.js';
import { createContentResponse, updateContentResponse } from './mutations.js';
import { loadContentById, loadContentDetail, loadContentHistory, loadContentListItems } from './repository.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const resolveContentAccess = async (
  actor: {
    instanceId: string;
    keycloakSubject: string;
    requestId?: string;
    traceId?: string;
  }
): Promise<IamContentAccessSummary> => {
  try {
    const resolved = await resolveEffectivePermissions({
      instanceId: actor.instanceId,
      keycloakSubject: actor.keycloakSubject,
    });

    if (!resolved.ok) {
      logger.error('Content access resolution failed', {
        operation: 'content_access',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: resolved.error,
      });

      return {
        state: 'read_only',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'context_restricted',
        organizationIds: [],
        sourceKinds: [],
      };
    }

    return summarizeContentAccess(resolved.permissions);
  } catch (error) {
    logger.error('Content access resolution failed', {
      operation: 'content_access',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      state: 'read_only',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'context_restricted',
      organizationIds: [],
      sourceKinds: [],
    };
  }
};

export const listContentsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  try {
    const [items, access] = await Promise.all([
      loadContentListItems(actorResolution.actor.instanceId),
      resolveContentAccess(actorResolution.actor),
    ]);
    const itemsWithAccess = items.map((item) => ({ ...item, access }));
    const pageSize = Math.max(1, items.length);
    return new Response(
      JSON.stringify(asApiList(itemsWithAccess, { page: 1, pageSize, total: items.length }, actorResolution.actor.requestId)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Content list query failed', {
      operation: 'content_list',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Inhalte konnten nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const getContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actorResolution.actor.requestId);
  }

  try {
    const [item, access] = await Promise.all([
      loadContentDetail(actorResolution.actor.instanceId, contentId),
      resolveContentAccess(actorResolution.actor),
    ]);
    return item
      ? new Response(JSON.stringify(asApiItem({ ...item, access }, actorResolution.actor.requestId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      : createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actorResolution.actor.requestId);
  } catch (error) {
    logger.error('Content detail query failed', {
      operation: 'content_detail',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Inhalt konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const getContentHistoryInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actorResolution.actor.requestId);
  }

  try {
    const item = await loadContentById(actorResolution.actor.instanceId, contentId);
    if (!item) {
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actorResolution.actor.requestId);
    }

    const history = await loadContentHistory(actorResolution.actor.instanceId, contentId);
    const pageSize = Math.max(1, history.length);
    return new Response(
      JSON.stringify(asApiList(history, { page: 1, pageSize, total: history.length }, actorResolution.actor.requestId)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Content history query failed', {
      operation: 'content_history',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      content_id: contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Historie konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const createContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : createContentResponse(request, actorResolution.actor);
};

export const updateContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : updateContentResponse(request, actorResolution.actor);
};

export const listContentsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, listContentsInternal);

export const getContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, getContentInternal);

export const getContentHistoryHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, getContentHistoryInternal);

export const createContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, createContentInternal);

export const updateContentHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedContentHandler(request, updateContentInternal);
