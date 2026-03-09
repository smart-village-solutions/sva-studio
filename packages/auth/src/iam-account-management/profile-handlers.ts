import { getWorkspaceContext } from '@sva/sdk/server';

import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { jsonResponse } from '../shared/db-helpers';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers';
import { ensureFeature, getFeatureFlags } from './feature-flags';
import {
  loadMyProfileDetail,
  type ProfileUpdatePayload,
  updateMyProfileDetail,
} from './profile-commands';
import { consumeRateLimit } from './rate-limit';
import {
  iamUserOperationsCounter,
  logger,
  resolveActorInfo,
  resolveIdentityProvider,
  trackKeycloakCall,
} from './shared';
import { validateCsrf } from './csrf';
import { updateMyProfileSchema } from './schemas';
import type { ActorInfo } from './types';

type ProfileActorContext = {
  actor: ActorInfo;
  dbKeycloakSubject: string;
};

const resolveProfileActorContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  scope: 'read' | 'write',
  options?: { validateWriteCsrf?: boolean }
): Promise<ProfileActorContext | Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  if (options?.validateWriteCsrf) {
    const csrfError = validateCsrf(request, actorResolution.actor.requestId);
    if (csrfError) {
      return csrfError;
    }
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope,
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  return {
    actor: actorResolution.actor,
    dbKeycloakSubject: ctx.user.id,
  };
};

const readProfileUpdatePayload = async (
  request: Request,
  requestId?: string
): Promise<{ data: ProfileUpdatePayload } | { error: Response }> => {
  const parsed = await parseRequestBody(request, updateMyProfileSchema);
  if (!parsed.ok) {
    return {
      error: createApiError(400, 'invalid_request', 'Ungültiger Payload.', requestId),
    };
  }
  return { data: parsed.data };
};

const createProfileNotFoundResponse = (requestId?: string): Response =>
  createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', requestId);

const handleProfileUpdateError = (actor: ActorInfo, error: unknown): Response => {
  if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Profil konnte nicht mit Keycloak synchronisiert werden.',
      actor.requestId
    );
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const [errorCode] = errorMessage.split(':', 2);
  if (errorCode === 'pii_encryption_required') {
    return createApiError(
      503,
      'internal_error',
      'PII-Verschlüsselung ist nicht konfiguriert.',
      actor.requestId
    );
  }

  logger.error('IAM profile update failed', {
    operation: 'update_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error: errorMessage,
  });
  iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'failure' });
  return createApiError(500, 'internal_error', 'Profil konnte nicht aktualisiert werden.', actor.requestId);
};

const handleProfileFetchError = (actor: ActorInfo, error: unknown): Response => {
  logger.error('IAM profile fetch failed', {
    operation: 'get_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error: error instanceof Error ? error.message : String(error),
  });
  iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'failure' });
  return createApiError(500, 'internal_error', 'Profil konnte nicht geladen werden.', actor.requestId);
};

export const updateMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorContext = await resolveProfileActorContext(request, ctx, 'write', { validateWriteCsrf: true });
  if (actorContext instanceof Response) {
    return actorContext;
  }

  const payload = await readProfileUpdatePayload(request, actorContext.actor.requestId);
  if ('error' in payload) {
    return payload.error;
  }

  try {
    const existingDetail = await loadMyProfileDetail(actorContext.actor, actorContext.dbKeycloakSubject);
    if (!existingDetail) {
      return createProfileNotFoundResponse(actorContext.actor.requestId);
    }

    const identityProvider = resolveIdentityProvider();
    if (!identityProvider) {
      return createApiError(
        503,
        'keycloak_unavailable',
        'Keycloak Admin API ist nicht konfiguriert.',
        actorContext.actor.requestId
      );
    }

    const shouldUpdateIdentity =
      payload.data.username !== undefined ||
      payload.data.email !== undefined ||
      payload.data.firstName !== undefined ||
      payload.data.lastName !== undefined ||
      payload.data.displayName !== undefined;

    let shouldRestoreIdentity = false;

    try {
      if (shouldUpdateIdentity) {
        await trackKeycloakCall('update_my_profile', () =>
          identityProvider.provider.updateUser(existingDetail.keycloakSubject, {
            username: payload.data.username,
            email: payload.data.email,
            firstName: payload.data.firstName,
            lastName: payload.data.lastName,
            attributes:
              payload.data.displayName !== undefined
                ? {
                    displayName: payload.data.displayName,
                  }
                : undefined,
          })
        );
        shouldRestoreIdentity = true;
      }

      const detail = await updateMyProfileDetail(
        actorContext.actor,
        actorContext.dbKeycloakSubject,
        payload.data
      );
      if (!detail) {
        return createProfileNotFoundResponse(actorContext.actor.requestId);
      }

      iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'success' });
      return jsonResponse(200, asApiItem(detail, actorContext.actor.requestId));
    } catch (error) {
      if (shouldRestoreIdentity) {
        try {
          await trackKeycloakCall('update_my_profile_compensation', () =>
            identityProvider.provider.updateUser(existingDetail.keycloakSubject, {
              username: existingDetail.username,
              email: existingDetail.email,
              firstName: existingDetail.firstName,
              lastName: existingDetail.lastName,
              attributes: {
                displayName: existingDetail.displayName,
              },
            })
          );
        } catch (compensationError) {
          logger.error('IAM profile update compensation failed', {
            operation: 'update_my_profile_compensation',
            instance_id: actorContext.actor.instanceId,
            request_id: actorContext.actor.requestId,
            trace_id: actorContext.actor.traceId,
            keycloak_subject: existingDetail.keycloakSubject,
            error:
              compensationError instanceof Error ? compensationError.message : String(compensationError),
          });
        }
      }

      throw error;
    }
  } catch (error) {
    return handleProfileUpdateError(actorContext.actor, error);
  }
};

export const getMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorContext = await resolveProfileActorContext(request, ctx, 'read');
  if (actorContext instanceof Response) {
    return actorContext;
  }

  try {
    const detail = await loadMyProfileDetail(actorContext.actor, actorContext.dbKeycloakSubject);
    if (!detail) {
      return createProfileNotFoundResponse(actorContext.actor.requestId);
    }

    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorContext.actor.requestId));
  } catch (error) {
    return handleProfileFetchError(actorContext.actor, error);
  }
};
