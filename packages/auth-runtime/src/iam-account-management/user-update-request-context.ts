import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';

import { createApiError, parseRequestBody } from './api-helpers.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { updateUserSchema } from './schemas.js';
import {
  type UserMutationActor,
  requireUserId,
  requireUserMutationIdentityProvider,
  resolveUserMutationActor,
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
  const actorResolution = await resolveUserMutationActor(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  const userId = requireUserId(request, actorResolution.actor.requestId);
  if (userId instanceof Response) {
    return userId;
  }

  const parsedBody = await parseRequestBody(request, updateUserSchema);
  if (!parsedBody.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = await requireUserMutationIdentityProvider(
    actorResolution.actor.instanceId,
    actorResolution.actor.requestId
  );
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  return {
    actor: actorResolution.actor,
    identityProvider,
    payload: parsedBody.data,
    userId,
  };
};
