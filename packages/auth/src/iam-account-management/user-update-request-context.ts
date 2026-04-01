import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { isUuid } from '../shared/input-readers.js';

import { ADMIN_ROLES } from './constants.js';
import { createApiError, parseRequestBody, readPathSegment } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { type ActorInfo, requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { resolveIdentityProvider } from './shared-runtime.js';
import { updateUserSchema } from './schemas.js';
import type { UpdateUserPayload } from './user-update-plan.js';

export type UserUpdateRequestContext =
  | Response
  | {
      actor: ActorInfo;
      identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
      payload: UpdateUserPayload;
      userId: string;
    };

export const resolveUpdateRequestContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<UserUpdateRequestContext> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsedBody = await parseRequestBody(request, updateUserSchema);
  if (!parsedBody.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  return {
    actor: actorResolution.actor,
    identityProvider,
    payload: parsedBody.data,
    userId,
  };
};
