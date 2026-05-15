import type { AuthenticatedRequestContext } from '../middleware.js';

import { ADMIN_ROLES } from './constants.js';
import { requireMutationIdentityProvider, requireMutationPathId, resolveMutationActorWithAccount, type MutationActorWithAccount } from './mutation-request-context.shared.js';
import type { IdentityProviderResolution } from './shared-runtime.js';

export type UserMutationActor = MutationActorWithAccount;

export const resolveUserMutationActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    feature: 'iam_admin' | 'iam_bulk';
    scope: 'write' | 'bulk';
    requestId?: string;
    provisionMissingActorMembership?: boolean;
  }
): Promise<{ actor: UserMutationActor } | { response: Response }> => {
  return resolveMutationActorWithAccount(request, ctx, {
    ...input,
    allowedRoles: ADMIN_ROLES,
    provisionMissingActorMembership: input.provisionMissingActorMembership ?? true,
  });
};

export const requireUserId = (request: Request, requestId?: string): string | Response => {
  return requireMutationPathId(request, { paramName: 'userId', requestId });
};

export const requireUserMutationIdentityProvider = async (instanceId: string, requestId?: string) => {
  return requireMutationIdentityProvider(instanceId, requestId);
};

export type UserMutationTargetActorContext =
  | Response
  | {
      actor: UserMutationActor;
      userId: string;
    };

export const resolveUserMutationTargetActorContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: Parameters<typeof resolveUserMutationActor>[2]
): Promise<UserMutationTargetActorContext> => {
  const actorResolution = await resolveUserMutationActor(request, ctx, input);
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  const userId = requireUserId(request, actorResolution.actor.requestId);
  if (userId instanceof Response) {
    return userId;
  }

  return {
    actor: actorResolution.actor,
    userId,
  };
};

export type UserMutationTargetContext =
  | Response
  | {
      actor: UserMutationActor;
      identityProvider: IdentityProviderResolution;
      userId: string;
    };

export const resolveUserMutationTargetContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: Parameters<typeof resolveUserMutationActor>[2]
): Promise<UserMutationTargetContext> => {
  const targetActorContext = await resolveUserMutationTargetActorContext(request, ctx, input);
  if (targetActorContext instanceof Response) {
    return targetActorContext;
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
    userId: targetActorContext.userId,
  };
};
