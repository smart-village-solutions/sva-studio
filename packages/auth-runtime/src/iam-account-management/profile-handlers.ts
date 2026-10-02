import { jsonResponse } from '../db.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

import { asApiItem } from './api-helpers.js';
import { loadMyProfileDetail } from './profile-commands.js';
import { handleProfileFetchError, handleProfileUpdateError } from './profile-errors.js';
import { readProfileUpdatePayload, resolvePlatformProfileRead, resolveProfileActorContext } from './profile-request-context.js';
import { applyIdentityProviderResolutionToAttemptState, createProfileNotFoundResponse, createProfileUpdateAttemptState, ensureIdentityProvider, resolveProjectedProfileDetail, runProfileUpdateMutation } from './profile-update-flow.js';
import { iamUserOperationsCounter, logger } from './shared.js';

export const updateMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorContext = await resolveProfileActorContext(request, ctx, 'write', {
    validateWriteCsrf: true,
  });
  if (actorContext instanceof Response) {
    return actorContext;
  }

  const payload = await readProfileUpdatePayload(request, actorContext.actor.requestId);
  if ('error' in payload) {
    return payload.error;
  }

  const attemptState = createProfileUpdateAttemptState();

  try {
    const existingDetail = await loadMyProfileDetail(
      actorContext.actor,
      actorContext.dbKeycloakSubject,
      actorContext.sessionProfile
    );
    if (!existingDetail) {
      return createProfileNotFoundResponse(actorContext.actor.requestId);
    }
    attemptState.existing_profile_loaded = true;
    attemptState.keycloak_subject = existingDetail.keycloakSubject;

    attemptState.failure_stage = 'identity_provider_resolution';
    const identityProviderResolution = await ensureIdentityProvider(
      actorContext.actor,
      existingDetail.keycloakSubject
    );
    if (identityProviderResolution instanceof Response) {
      return identityProviderResolution;
    }
    applyIdentityProviderResolutionToAttemptState(attemptState, identityProviderResolution);

    return await runProfileUpdateMutation({
      actor: actorContext.actor,
      dbKeycloakSubject: actorContext.dbKeycloakSubject,
      existingDetail,
      payload: payload.data,
      attemptState,
      updateUser: identityProviderResolution.provider.updateUser.bind(
        identityProviderResolution.provider
      ),
    });
  } catch (error) {
    return handleProfileUpdateError(actorContext.actor, error, attemptState);
  }
};

export const getMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const platformProfile = await resolvePlatformProfileRead(ctx);
  if (platformProfile instanceof Response) {
    return platformProfile;
  }
  if (platformProfile) {
    return jsonResponse(200, asApiItem(platformProfile.profile, platformProfile.requestId));
  }

  const actorContext = await resolveProfileActorContext(request, ctx, 'read');
  if (actorContext instanceof Response) {
    return actorContext;
  }

  try {
    logger.info('IAM profile fetch starting', {
      operation: 'get_my_profile',
      instance_id: actorContext.actor.instanceId,
      request_id: actorContext.actor.requestId,
      trace_id: actorContext.actor.traceId,
      actor_account_id: actorContext.actor.actorAccountId ?? null,
      db_keycloak_subject: actorContext.dbKeycloakSubject,
    });

    const detail = await loadMyProfileDetail(
      actorContext.actor,
      actorContext.dbKeycloakSubject,
      actorContext.sessionProfile
    );
    if (!detail) {
      return createProfileNotFoundResponse(actorContext.actor.requestId);
    }

    const projectedDetail = await resolveProjectedProfileDetail({
      instanceId: actorContext.actor.instanceId,
      user: detail,
    });

    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(projectedDetail, actorContext.actor.requestId));
  } catch (error) {
    return await handleProfileFetchError(actorContext.actor, ctx, error);
  }
};
