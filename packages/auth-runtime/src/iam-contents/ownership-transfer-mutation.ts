import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
} from '../iam-account-management/api-helpers.js';
import { jsonResponse } from '../db.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import {
  ContentOwnershipTransferError,
  loadContentById,
  transferContentOwnership,
} from './repository.js';
import type { ResolvedContentActor } from './request-context.js';
import { authorizeContentAction } from './request-context.js';
import { transferContentOwnershipSchema } from './schemas.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

export const resolveCurrentOwner = (content: {
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
}) => {
  if (content.ownerUserId && !content.ownerOrganizationId) {
    return { type: 'account' as const, id: content.ownerUserId };
  }
  if (content.ownerOrganizationId && !content.ownerUserId) {
    return { type: 'organization' as const, id: content.ownerOrganizationId };
  }
  return undefined;
};

export const transferErrorResponse = (
  error: ContentOwnershipTransferError,
  requestId?: string
): Response => {
  switch (error.code) {
    case 'content_not_found':
      return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', requestId);
    case 'ownership_target_not_found':
      return createApiError(404, 'not_found', 'Zielinhaber wurde nicht gefunden.', requestId);
    case 'ownership_target_inactive':
      return createApiError(409, 'conflict', 'Zielinhaber ist nicht aktiv.', requestId);
    case 'ownership_target_unchanged':
      return createApiError(409, 'conflict', 'Der Zielinhaber ist bereits zugeordnet.', requestId);
    case 'ownership_source_changed':
      return createApiError(409, 'conflict', 'Der aktuelle Inhaber hat sich geändert.', requestId);
  }
};

export const transferContentOwnershipResponse = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) return csrfError;
  const contentId = readPathSegment(request, 4);
  if (!contentId)
    return createApiError(400, 'invalid_request', 'Inhalts-ID fehlt.', actor.requestId);
  const parsed = await parseRequestBody(request, transferContentOwnershipSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  const currentContent = await loadContentById(actor.instanceId, contentId);
  if (!currentContent)
    return createApiError(404, 'not_found', 'Inhalt wurde nicht gefunden.', actor.requestId);
  const authorizationError = await authorizeContentAction(actor, 'content.transferOwnership', {
    contentId,
    contentType: currentContent.contentType,
    domainCapability: 'content.transfer_ownership',
    organizationId: currentContent.organizationId,
    ownerUserId: currentContent.ownerUserId,
    ownerOrganizationId: currentContent.ownerOrganizationId,
  });
  if (authorizationError) return authorizationError;
  try {
    const result = await transferContentOwnership({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId!,
      actorDisplayName: actor.actorDisplayName,
      requestId: actor.requestId,
      traceId: actor.traceId,
      contentId,
      expectedSourcePrincipal: resolveCurrentOwner(currentContent),
      targetPrincipal: parsed.data.targetPrincipal,
    });
    return jsonResponse(200, asApiItem(result, actor.requestId));
  } catch (error) {
    if (error instanceof ContentOwnershipTransferError)
      return transferErrorResponse(error, actor.requestId);
    logger.error('Content ownership transfer failed', {
      operation: 'content_transfer_ownership',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      content_id: contentId,
      target_principal_type: parsed.data.targetPrincipal.type,
      target_principal_id: parsed.data.targetPrincipal.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Inhalt konnte nicht übertragen werden.',
      actor.requestId
    );
  }
};
