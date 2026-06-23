import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import type { IdentityProviderPort } from '../identity-provider-port.js';

import { createApiError, parseRequestBody } from './api-helpers.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { updateUserSchema } from './schemas.js';
import {
  type UserMutationActor,
  requireUserMutationIdentityProvider,
  resolveUserMutationTargetActorContext,
} from './user-mutation-request-context.shared.js';
import type { UpdateUserPayload } from './user-update-plan.js';

export type UserUpdateIdentityProviderResolution = IdentityProviderResolution & {
  readonly provider: IdentityProviderResolution['provider'] &
    Required<Pick<IdentityProviderPort, 'assignRealmRoles' | 'removeRealmRoles'>>;
};

export type UserUpdateRequestContext =
  | Response
  | {
      actor: UserMutationActor;
      identityProvider: UserUpdateIdentityProviderResolution;
      payload: UpdateUserPayload;
      userId: string;
    };

const hasUserUpdateRoleCapabilities = (
  identityProvider: IdentityProviderResolution
): identityProvider is UserUpdateIdentityProviderResolution =>
  typeof identityProvider.provider.assignRealmRoles === 'function' &&
  typeof identityProvider.provider.removeRealmRoles === 'function';

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
  if (!hasUserUpdateRoleCapabilities(identityProvider)) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API unterstützt technische Rollenzuweisungen nicht.',
      targetActorContext.actor.requestId
    );
  }

  return {
    actor: targetActorContext.actor,
    identityProvider,
    payload: parsedBody.data,
    userId: targetActorContext.userId,
  };
};
