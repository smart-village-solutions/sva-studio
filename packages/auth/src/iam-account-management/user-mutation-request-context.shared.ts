import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { isUuid } from '../shared/input-readers.js';

import { ADMIN_ROLES } from './constants.js';
import { createActorResolutionDetails } from './diagnostics.js';
import { createApiError, readPathSegment } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { resolveIdentityProvider } from './shared-runtime.js';

type ResolvedActor = Exclude<Awaited<ReturnType<typeof resolveActorInfo>>, { error: Response }>['actor'];

export type UserMutationActor = ResolvedActor & { actorAccountId: string };

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
  const featureCheck = ensureFeature(getFeatureFlags(), input.feature, input.requestId);
  if (featureCheck) {
    return { response: featureCheck };
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, input.requestId);
  if (roleCheck) {
    return { response: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: input.provisionMissingActorMembership ?? true,
  });
  if ('error' in actorResolution) {
    return { response: actorResolution.error };
  }

  if (!actorResolution.actor.actorAccountId) {
    return {
      response: createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        actorResolution.actor.requestId,
        createActorResolutionDetails({
          actorResolution: 'missing_actor_account',
          instanceId: actorResolution.actor.instanceId,
        })
      ),
    };
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return { response: csrfError };
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: input.scope,
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { response: rateLimit };
  }

  return { actor: actorResolution.actor as UserMutationActor };
};

export const requireUserId = (request: Request, requestId?: string): string | Response => {
  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', requestId);
  }

  return userId;
};

export const requireUserMutationIdentityProvider = (requestId?: string) => {
  const identityProvider = resolveIdentityProvider();
  if (identityProvider) {
    return identityProvider;
  }

  return createApiError(
    503,
    'keycloak_unavailable',
    'Keycloak Admin API ist nicht konfiguriert.',
    requestId
  );
};
