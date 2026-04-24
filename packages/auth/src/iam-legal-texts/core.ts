import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { asApiList, createApiError } from '../iam-account-management/api-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';
import { createLegalTextResponse, deleteLegalTextResponse, updateLegalTextResponse } from './mutations.js';
import { loadLegalTextListItems, loadPendingLegalTexts } from './repository.js';
import {
  resolveLegalTextsAdminActor,
  withAuthenticatedLegalTextsHandler,
  withLegalTextsRequestContext,
} from './request-context.js';

const logger = createSdkLogger({ component: 'iam-legal-texts', level: 'info' });

export const listLegalTextsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveLegalTextsAdminActor(request, ctx);
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  try {
    const items = await loadLegalTextListItems(actorResolution.actor.instanceId);
    const pageSize = Math.max(1, items.length);
    return new Response(
      JSON.stringify(asApiList(items, { page: 1, pageSize, total: items.length }, actorResolution.actor.requestId)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Legal text list query failed', {
      operation: 'legal_texts_list',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Rechtstexte konnten nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const createLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveLegalTextsAdminActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : createLegalTextResponse(request, actorResolution.actor);
};

export const updateLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveLegalTextsAdminActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : updateLegalTextResponse(request, actorResolution.actor);
};

export const deleteLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveLegalTextsAdminActor(request, ctx, { requireActorAccountId: true });
  return 'error' in actorResolution ? actorResolution.error : deleteLegalTextResponse(request, actorResolution.actor);
};

export const listLegalTextsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, listLegalTextsInternal);

export const listPendingLegalTextsHandler = async (request: Request): Promise<Response> =>
  withLegalTextsRequestContext(request, async () =>
    withAuthenticatedUser(request, async ({ user }) => {
      const requestId = getWorkspaceContext().requestId;

      if (!user.instanceId) {
        return createApiError(401, 'unauthorized', 'Instanzkontext fehlt.', requestId);
      }

      try {
        const items = await loadPendingLegalTexts(user.instanceId, user.id);
        const pageSize = Math.max(1, items.length);
        return new Response(JSON.stringify(asApiList(items, { page: 1, pageSize, total: items.length }, requestId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('Pending legal text query failed', {
          operation: 'legal_texts_pending',
          instance_id: user.instanceId,
          user_id: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return createApiError(503, 'database_unavailable', 'Offene Rechtstexte konnten nicht geladen werden.', requestId);
      }
    })
  );

export const createLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, createLegalTextInternal);

export const updateLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, updateLegalTextInternal);

export const deleteLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, deleteLegalTextInternal);
