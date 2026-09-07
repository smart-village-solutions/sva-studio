import type { IamContentOwnerPrincipal } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiList,
  createApiError,
  readPage,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { loadContentById, loadContentOwnershipTargets } from './repository.js';
import { ContentOwnershipAccountSearchError } from './ownership-account-targets.js';
import { resolveContentOwnerPrincipal } from './ownership-principal.js';
import { authorizeContentAction, resolveContentActor } from './request-context.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });
const MAX_OWNERSHIP_TARGET_SEARCH_LENGTH = 200;

const resolveCurrentOwner = (content: {
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
}): IamContentOwnerPrincipal | undefined => {
  return resolveContentOwnerPrincipal(content);
};

const readOwnershipTargetSearch = (
  request: Request,
  requestId: string | undefined
): string | undefined | Response => {
  const search = new URL(request.url).searchParams.get('q')?.trim() || undefined;
  return search && search.length > MAX_OWNERSHIP_TARGET_SEARCH_LENGTH
    ? createApiError(400, 'invalid_request', 'Der Suchbegriff ist zu lang.', requestId)
    : search;
};

export const listContentOwnershipTargetsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) return actorResolution.error;
  const contentId = readPathSegment(request, 4);
  if (!contentId)
    return createApiError(
      400,
      'invalid_request',
      'Inhalts-ID fehlt.',
      actorResolution.actor.requestId
    );
  const content = await loadContentById(actorResolution.actor.instanceId, contentId);
  if (!content)
    return createApiError(
      404,
      'not_found',
      'Inhalt wurde nicht gefunden.',
      actorResolution.actor.requestId
    );
  const authorizationError = await authorizeContentAction(
    actorResolution.actor,
    'content.transferOwnership',
    {
      contentId,
      contentType: content.contentType,
      domainCapability: 'content.transfer_ownership',
      organizationId: content.organizationId,
      ownerUserId: content.ownerUserId,
      ownerOrganizationId: content.ownerOrganizationId,
    }
  );
  if (authorizationError) return authorizationError;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'account';
  if (type !== 'account' && type !== 'organization') {
    return createApiError(
      400,
      'invalid_request',
      'Zielinhabertyp ist ungültig.',
      actorResolution.actor.requestId
    );
  }
  const { page, pageSize } = readPage(request);
  const search = readOwnershipTargetSearch(request, actorResolution.actor.requestId);
  if (search instanceof Response) return search;
  const currentOwner = resolveCurrentOwner(content);
  try {
    const result = await loadContentOwnershipTargets(actorResolution.actor.instanceId, {
      type,
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(currentOwner ? { currentOwner } : {}),
    });
    return new Response(
      JSON.stringify(
        asApiList(
          result.items,
          { page: result.page, pageSize: result.pageSize, total: result.total },
          actorResolution.actor.requestId
        )
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Content ownership target query failed', {
      operation: 'content_ownership_targets',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      content_id: contentId,
      target_principal_type: type,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof ContentOwnershipAccountSearchError) {
      return createApiError(
        503,
        'keycloak_unavailable',
        'Die Account-Suche ist derzeit nicht verfügbar.',
        actorResolution.actor.requestId
      );
    }
    return createApiError(
      503,
      'database_unavailable',
      'Zielinhaber konnten nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};
