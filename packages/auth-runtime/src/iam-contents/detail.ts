import { isUuid, type IamContentListItem } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiItem,
  createApiError,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { loadExternalContentReferenceBySourceEntity } from './external-content-references.js';
import { loadMainserverContentProjectionCandidates } from './mainserver-content-projection.js';
import {
  authorizeReadableContentItem,
  hasGlobalContentMutationPermission,
} from './read-authorization.js';
import {
  resolveContentAccess,
  resolveContentActor,
  type ResolvedContentActor,
} from './request-context.js';
import { loadContentById, loadContentDetail } from './repository.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

const loadProjectedMainserverContent = async (
  actor: ResolvedContentActor['actor'],
  contentType: string,
  sourceEntityId: string
): Promise<IamContentListItem | undefined> => {
  const projectionInput = {
    instanceId: actor.instanceId,
    contentType,
    sourceEntityId,
    actorAccountId: actor.actorAccountId,
    activeOrganizationId: actor.activeOrganizationId,
  } as const;
  let candidates = await loadMainserverContentProjectionCandidates(projectionInput);
  if (
    candidates.length !== 1 &&
    (await hasGlobalContentMutationPermission(actor, contentType))
  ) {
    candidates = await loadMainserverContentProjectionCandidates({
      ...projectionInput,
      allowGlobalMutation: true,
    });
  }
  return candidates.length === 1 ? candidates[0] : undefined;
};

export const getContentInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveContentActor(request, ctx);
  if ('error' in actorResolution) return actorResolution.error;

  const contentId = readPathSegment(request, 4);
  if (!contentId) {
    return createApiError(
      400,
      'invalid_request',
      'Inhalts-ID fehlt.',
      actorResolution.actor.requestId
    );
  }

  try {
    const contentType = new URL(request.url).searchParams.get('contentType')?.trim();
    let item: IamContentListItem | undefined;
    let projectedItem = false;
    if (contentType) {
      const reference = await loadExternalContentReferenceBySourceEntity({
        instanceId: actorResolution.actor.instanceId,
        sourceSystem: 'mainserver',
        sourceEntityType: contentType,
        sourceEntityId: contentId,
      });
      if (reference) {
        item = await loadContentById(actorResolution.actor.instanceId, reference.contentId);
      } else {
        item = await loadProjectedMainserverContent(
          actorResolution.actor,
          contentType,
          contentId
        );
        if (item) {
          projectedItem = true;
        }
      }
    }
    if (!item && (!contentType || isUuid(contentId))) {
      item = await loadContentById(actorResolution.actor.instanceId, contentId);
    }
    if (!item) {
      return createApiError(
        404,
        'not_found',
        'Inhalt wurde nicht gefunden.',
        actorResolution.actor.requestId
      );
    }

    const authorizationError = await authorizeReadableContentItem(actorResolution.actor, item);
    if (authorizationError) return authorizationError;

    const [detail, access] = await Promise.all([
      projectedItem
        ? Promise.resolve({ ...item, history: [] })
        : loadContentDetail(actorResolution.actor.instanceId, item.id),
      resolveContentAccess(actorResolution.actor),
    ]);
    return detail
      ? new Response(
          JSON.stringify(asApiItem({ ...detail, access }, actorResolution.actor.requestId)),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      : createApiError(
          404,
          'not_found',
          'Inhalt wurde nicht gefunden.',
          actorResolution.actor.requestId
        );
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
