import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';

import { createApiError, parseRequestBody } from './api-helpers.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { updateUserSchema } from './schemas.js';
import {
  type UserMutationActor,
  requireUserMutationIdentityProvider,
  resolveUserMutationTargetActorContext,
} from './user-mutation-request-context.shared.js';
import type { UpdateUserPayload } from './user-update-plan.js';

export type UserUpdateRequestContext =
  | Response
  | {
      actor: UserMutationActor;
      identityProvider: IdentityProviderResolution;
      payload: UpdateUserPayload;
      userId: string;
    };

export const resolveUpdateRequestContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<UserUpdateRequestContext> => {
  const requestContext = getWorkspaceContext();
  const targetActorContext = await resolveUserMutationTargetActorContext(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if (targetActorContext instanceof Response) {
    return targetActorContext;
  }

  const parsedBody = await parseRequestBody(request, updateUserSchema);
  if (!parsedBody.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', targetActorContext.actor.requestId);
  }

  const identityProvider = await requireUserMutationIdentityProvider(
    targetActorContext.actor.instanceId,
    targetActorContext.actor.requestId
  );
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  return {
    actor: targetActorContext.actor,
    identityProvider,
    payload: parsedBody.data,
    userId: targetActorContext.userId,
  };
};
