import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';

import { createApiError, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import { reserveIdempotency } from './shared.js';
import {
  requireUserId,
  requireUserMutationIdentityProvider,
  resolveUserMutationActor,
} from './user-mutation-request-context.shared.js';
import { processPasswordSetupEmailSend } from './user-password-setup-email-send.js';

const SEND_PASSWORD_SETUP_EMAIL_ENDPOINT = 'POST:/api/v1/iam/users/$userId/send-password-setup-email';

export const sendPasswordSetupEmailInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const actorResolution = await resolveUserMutationActor(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  const actor = actorResolution.actor;
  const userId = requireUserId(request, actor.requestId);
  if (userId instanceof Response) {
    return userId;
  }

  const identityProvider = await requireUserMutationIdentityProvider(actor.instanceId, actor.requestId);
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  const idempotencyKey = requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const rawBody = await request.text();
  const payloadHash = toPayloadHash(rawBody);
  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: SEND_PASSWORD_SETUP_EMAIL_ENDPOINT,
    idempotencyKey: idempotencyKey.key,
    payloadHash,
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }

  return processPasswordSetupEmailSend({
    actor,
    ctx,
    endpoint: SEND_PASSWORD_SETUP_EMAIL_ENDPOINT,
    executeActionsEmail: identityProvider.provider.executeActionsEmail?.bind(identityProvider.provider),
    idempotencyKey: idempotencyKey.key,
    userId,
  });
};
