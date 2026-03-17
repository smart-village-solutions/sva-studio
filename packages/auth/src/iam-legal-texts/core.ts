import { createSdkLogger } from '@sva/sdk/server';

import { asApiList, createApiError } from '../iam-account-management/api-helpers';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { createLegalTextResponse, updateLegalTextResponse } from './mutations';
import { loadLegalTextListItems } from './repository';
import { resolveLegalTextsAdminActor, withAuthenticatedLegalTextsHandler } from './request-context';

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
    return new Response(
      JSON.stringify(asApiList(items, { page: 1, pageSize: items.length, total: items.length }, actorResolution.actor.requestId)),
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

export const listLegalTextsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, listLegalTextsInternal);

export const createLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, createLegalTextInternal);

export const updateLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, updateLegalTextInternal);
