import type { AuthenticatedRequestContext } from '../middleware.js';
import { isUuid } from '../shared/input-readers.js';

import { createActorResolutionDetails } from './diagnostics.js';
import { createApiError, readPathSegment } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { resolveIdentityProviderForInstance } from './shared-runtime.js';

type ResolvedActor = Exclude<Awaited<ReturnType<typeof resolveActorInfo>>, { error: Response }>['actor'];

export type MutationActorWithAccount = ResolvedActor & { actorAccountId: string };

export const resolveMutationActorWithAccount = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    allowedRoles: ReadonlySet<string>;
    feature: 'iam_admin' | 'iam_bulk';
    scope: 'write' | 'bulk';
    requestId?: string;
    provisionMissingActorMembership?: boolean;
  }
): Promise<{ actor: MutationActorWithAccount } | { response: Response }> => {
  const featureCheck = ensureFeature(getFeatureFlags(), input.feature, input.requestId);
  if (featureCheck) {
    return { response: featureCheck };
  }

  const roleCheck = requireRoles(ctx, input.allowedRoles, input.requestId);
  if (roleCheck) {
    return { response: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: input.provisionMissingActorMembership,
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

  return {
    actor: actorResolution.actor as MutationActorWithAccount,
  };
};

export const requireMutationPathId = (
  request: Request,
  input: {
    paramName: 'roleId' | 'userId';
    requestId?: string;
    segmentIndex?: number;
  }
): string | Response => {
  const entityId = readPathSegment(request, input.segmentIndex ?? 4);
  if (!entityId || !isUuid(entityId)) {
    return createApiError(400, 'invalid_request', `Ungültige ${input.paramName}.`, input.requestId);
  }

  return entityId;
};

export const requireMutationIdentityProvider = async (
  instanceId: string,
  requestId?: string,
  input?: {
    syncError?: { code: 'IDP_UNAVAILABLE' };
    syncState?: 'failed';
  }
) => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
  if (identityProvider) {
    return identityProvider;
  }

  return createApiError(
    409,
    'tenant_admin_client_not_configured',
    'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
    requestId,
    {
      dependency: 'keycloak',
      execution_mode: 'tenant_admin',
      instance_id: instanceId,
      reason_code: 'tenant_admin_client_not_configured',
      ...(input?.syncState ? { syncState: input.syncState } : {}),
      ...(input?.syncError ? { syncError: input.syncError } : {}),
    }
  );
};
