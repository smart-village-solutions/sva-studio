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

export type UserUpdateIdentityProviderResolution = IdentityProviderResolution;

export type UserUpdateRequestContext =
  | Response
  | {
      actor: UserMutationActor;
      payload: UpdateUserPayload;
      resolveIdentityProvider: () => Promise<UserUpdateIdentityProviderResolution | Response>;
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

  return {
    actor: targetActorContext.actor,
    payload: parsedBody.data,
    resolveIdentityProvider: () =>
      requireUserMutationIdentityProvider(targetActorContext.actor.instanceId, targetActorContext.actor.requestId),
    userId: targetActorContext.userId,
  };
};
