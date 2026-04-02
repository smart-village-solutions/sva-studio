import type { AuthenticatedRequestContext } from '../middleware.server.js';
import type { IdentityManagedRoleAttributes } from '../identity-provider-port.js';
import { isUuid } from '../shared/input-readers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { createActorResolutionDetails } from './diagnostics.js';
import { createApiError, readPathSegment } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { validateCsrf } from './csrf.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { resolveIdentityProviderForInstance } from './shared-runtime.js';

type ResolvedActor = Exclude<Awaited<ReturnType<typeof resolveActorInfo>>, { error: Response }>['actor'];

export type RoleMutationActor = ResolvedActor & { actorAccountId: string };

export const resolveRoleMutationActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId?: string
): Promise<{ actor: RoleMutationActor } | { response: Response }> => {
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestId);
  if (featureCheck) {
    return { response: featureCheck };
  }

  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestId);
  if (roleCheck) {
    return { response: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
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
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { response: rateLimit };
  }

  return {
    actor: actorResolution.actor as RoleMutationActor,
  };
};

export const requireRoleId = (request: Request, requestId?: string): string | Response => {
  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', requestId);
  }

  return roleId;
};

export const requireRoleIdentityProvider = async (instanceId: string, requestId?: string) => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId);
  if (identityProvider) {
    return identityProvider;
  }

  return createApiError(
    503,
    'keycloak_unavailable',
    'Keycloak Admin API ist nicht konfiguriert.',
    requestId,
    {
      syncState: 'failed',
      syncError: { code: 'IDP_UNAVAILABLE' },
    }
  );
};

export const buildRoleAttributes = (input: {
  instanceId: string;
  roleKey: string;
  displayName: string;
}): IdentityManagedRoleAttributes => {
  return {
    managedBy: 'studio',
    instanceId: input.instanceId,
    roleKey: input.roleKey,
    displayName: input.displayName,
  };
};
