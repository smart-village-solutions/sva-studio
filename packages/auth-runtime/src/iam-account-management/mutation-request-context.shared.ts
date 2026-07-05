import type { AuthenticatedRequestContext } from '../middleware.js';
import { isUuid } from '../shared/input-readers.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';

import { createActorResolutionDetails } from './diagnostics.js';
import { createApiError, readPathSegment } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { resolveIdentityProviderForInstance } from './shared-runtime.js';

type ResolvedActor = Exclude<Awaited<ReturnType<typeof resolveActorInfo>>, { error: Response }>['actor'];

export type MutationActorWithAccount = ResolvedActor & { actorAccountId: string };

const finalizeResolvedMutationActor = (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    scope: 'write' | 'bulk';
  },
  actor: ResolvedActor
): { actor: MutationActorWithAccount } | { response: Response } => {
  if (!actor.actorAccountId) {
    return {
      response: createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        actor.requestId,
        createActorResolutionDetails({
          actorResolution: 'missing_actor_account',
          instanceId: actor.instanceId,
        })
      ),
    };
  }

  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return { response: csrfError };
  }

  const rateLimit = consumeRateLimit({
    instanceId: actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: input.scope,
    requestId: actor.requestId,
  });
  if (rateLimit) {
    return { response: rateLimit };
  }

  return {
    actor: actor as MutationActorWithAccount,
  };
};

const resolveRequiredPermissionActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    requiredPermissionAction: string;
    provisionMissingActorMembership?: boolean;
    requestId?: string;
  }
): Promise<{ actor: ResolvedActor } | { response: Response }> => {
  const actorResolution = await resolveActorInfo(request, ctx, {
    provisionMissingActorMembership: false,
  });
  if ('error' in actorResolution) {
    return { response: actorResolution.error };
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx,
    action: input.requiredPermissionAction,
    instanceId: actorResolution.actor.instanceId,
  });
  if (!authorization.ok) {
    return {
      response: createApiError(
        authorization.status,
        toInstancePermissionApiErrorCode(authorization.error),
        authorization.message,
        input.requestId
      ),
    };
  }

  const authorizedActorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: input.provisionMissingActorMembership,
  });
  if ('error' in authorizedActorResolution) {
    return { response: authorizedActorResolution.error };
  }

  return { actor: authorizedActorResolution.actor };
};

export const resolveMutationActorWithAccount = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    allowedRoles: ReadonlySet<string>;
    requiredPermissionAction?: string;
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

  if (input.requiredPermissionAction) {
    const resolved = await resolveRequiredPermissionActor(request, ctx, {
      requiredPermissionAction: input.requiredPermissionAction,
      provisionMissingActorMembership: input.provisionMissingActorMembership,
      requestId: input.requestId,
    });
    if ('response' in resolved) {
      return resolved;
    }
    return finalizeResolvedMutationActor(request, ctx, input, resolved.actor);
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

  return finalizeResolvedMutationActor(request, ctx, input, actorResolution.actor);
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
