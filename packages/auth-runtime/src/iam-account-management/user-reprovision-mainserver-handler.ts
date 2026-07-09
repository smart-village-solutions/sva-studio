import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';

import { requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import { ensureActorCanManageTarget, resolveActorMaxRoleLevel } from './shared-actor-authorization.js';
import { withInstanceScopedDb } from './shared.js';
import { resolveUserDetail } from './user-detail-query.js';
import { resolveUserMutationTargetContext } from './user-mutation-request-context.shared.js';
import {
  buildProvisioningErrorResponse,
  completeReprovisionIdempotency,
  createReprovisionConflictResponse,
  createTerminalReprovisionResponse,
  reprovisionMainserverCredentials,
  reserveReprovisionIdempotency,
  type MainserverReprovisionActor,
} from './user-reprovision-mainserver-shared.js';

const resolveTargetUser = async (input: {
  actor: MainserverReprovisionActor;
  ctx: AuthenticatedRequestContext;
  userId: string;
}) =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const detail = await resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
    if (!detail) {
      return { kind: 'not_found' } as const;
    }

    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const targetAccess = ensureActorCanManageTarget({
      actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: detail.roles,
    });
    if (!targetAccess.ok) {
      return { kind: 'forbidden', failure: targetAccess } as const;
    }

    return { kind: 'ok', user: detail } as const;
  });

export const reprovisionMainserverUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const targetContext = await resolveUserMutationTargetContext(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if (targetContext instanceof Response) {
    return targetContext;
  }

  const requestId = targetContext.actor.requestId ?? requestContext.requestId;
  const idempotencyKey = requireIdempotencyKey(request, requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const reserve = await reserveReprovisionIdempotency({
    actor: targetContext.actor,
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(await request.text()),
    requestId,
  });
  if (reserve.kind === 'response') {
    return reserve.response;
  }

  const resolvedTarget = await resolveTargetUser({
    actor: targetContext.actor,
    ctx,
    userId: targetContext.userId,
  });
  if (resolvedTarget.kind === 'not_found') {
    return completeReprovisionIdempotency({
      actor: targetContext.actor,
      idempotencyKey: idempotencyKey.key,
      response: createTerminalReprovisionResponse(requestId, 404, 'not_found', 'Nutzer nicht gefunden.'),
    });
  }
  if (resolvedTarget.kind === 'forbidden') {
    return completeReprovisionIdempotency({
      actor: targetContext.actor,
      idempotencyKey: idempotencyKey.key,
      response: createTerminalReprovisionResponse(requestId, 403, 'forbidden', resolvedTarget.failure.message),
    });
  }
  if (!resolvedTarget.user.email) {
    return completeReprovisionIdempotency({
      actor: targetContext.actor,
      idempotencyKey: idempotencyKey.key,
      response: createReprovisionConflictResponse(requestId, 'Für den Nutzer ist keine E-Mail-Adresse hinterlegt.'),
    });
  }

  try {
    const result = await reprovisionMainserverCredentials({
      actor: targetContext.actor,
      actorSubject: ctx.user.id,
      identityProvider: targetContext.identityProvider.provider,
      requestId,
      user: {
        email: resolvedTarget.user.email,
        firstName: resolvedTarget.user.firstName,
        id: resolvedTarget.user.id,
        keycloakSubject: resolvedTarget.user.keycloakSubject,
        lastName: resolvedTarget.user.lastName,
      },
    });
    return completeReprovisionIdempotency({
      actor: targetContext.actor,
      idempotencyKey: idempotencyKey.key,
      response: result.response,
    });
  } catch (error) {
    return completeReprovisionIdempotency({
      actor: targetContext.actor,
      idempotencyKey: idempotencyKey.key,
      response: buildProvisioningErrorResponse(requestId, error),
    });
  }
};
