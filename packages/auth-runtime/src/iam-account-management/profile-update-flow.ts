import type { IamUserDetail } from '@sva/core';
import type { UpdateIdentityUserInput } from '../identity-provider-port.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { loadMyProfileDetail, type ProfileUpdatePayload, updateMyProfileDetail } from './profile-commands.js';
import { markUserProjectionDegraded } from './projection-diagnostics.js';
import { iamUserOperationsCounter, logger, resolveIdentityProviderForInstance, trackKeycloakCall } from './shared.js';
import type { ActorInfo } from './types.js';
import { applyCanonicalUserDetailProjection, resolveKeycloakRoleNames, resolveProjectedMainserverCredentialState } from './user-projection.js';

type ProfileUpdateFailureStage =
  | 'load_existing_profile'
  | 'identity_provider_resolution'
  | 'identity_sync'
  | 'local_persistence'
  | 'projection';

type ResolvedTenantIdentityProvider = Exclude<
  Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>,
  null
>;

export type ProfileUpdateAttemptState = {
  existing_profile_loaded: boolean;
  identity_provider_resolved: boolean;
  identity_sync_attempted: boolean;
  identity_sync_succeeded: boolean;
  local_db_write_attempted: boolean;
  local_db_write_succeeded: boolean;
  compensation_attempted: boolean;
  compensation_succeeded: boolean;
  projected_detail_resolved: boolean;
  failure_stage: ProfileUpdateFailureStage;
  provider_realm?: string;
  provider_admin_realm?: string;
  provider_client_id?: string;
  provider_source?: string;
  provider_execution_mode?: string;
  keycloak_subject?: string;
};
export const createProfileNotFoundResponse = (requestId?: string): Response =>
  createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', requestId);

const DEFAULT_MAINSERVER_CREDENTIAL_STATE = {
  mainserverUserApplicationId: undefined,
  mainserverUserApplicationSecretSet: false,
} as const;

export const resolveProjectedProfileDetail = async (input: {
  instanceId: string;
  user: IamUserDetail;
}): Promise<IamUserDetail> => {
  const [keycloakRoleNamesResult, mainserverCredentialStateResult] = await Promise.allSettled([
    resolveKeycloakRoleNames(input.instanceId, input.user.keycloakSubject),
    resolveProjectedMainserverCredentialState(input.user.keycloakSubject, input.instanceId),
  ]);

  const projectedDetail = await applyCanonicalUserDetailProjection({
    instanceId: input.instanceId,
    user: input.user,
    keycloakRoleNames:
      keycloakRoleNamesResult.status === 'fulfilled' ? keycloakRoleNamesResult.value : null,
    mainserverCredentialState:
      mainserverCredentialStateResult.status === 'fulfilled'
        ? mainserverCredentialStateResult.value
        : DEFAULT_MAINSERVER_CREDENTIAL_STATE,
  });

  return keycloakRoleNamesResult.status === 'rejected'
    ? markUserProjectionDegraded(projectedDetail)
    : projectedDetail;
};

export const ensureIdentityProvider = async (
  actor: ActorInfo,
  keycloakSubject?: string
): Promise<Response | ResolvedTenantIdentityProvider> => {
  const identityProvider = await resolveIdentityProviderForInstance(actor.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    return createApiError(
      409,
      'tenant_admin_client_not_configured',
      'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
      actor.requestId,
      {
        dependency: 'keycloak',
        execution_mode: 'tenant_admin',
        instance_id: actor.instanceId,
        reason_code: 'tenant_admin_client_not_configured',
      }
    );
  }

  logger.info('IAM profile tenant identity provider resolved', {
    operation: 'update_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    keycloak_subject: keycloakSubject,
    realm: identityProvider.realm,
    admin_realm: identityProvider.adminRealm,
    client_id: identityProvider.clientId,
    source: identityProvider.source,
    execution_mode: identityProvider.executionMode,
  });

  return identityProvider;
};

const shouldUpdateIdentityProfile = (payload: ProfileUpdatePayload): boolean =>
  payload.username !== undefined ||
  payload.email !== undefined ||
  payload.firstName !== undefined ||
  payload.lastName !== undefined ||
  payload.displayName !== undefined;

const buildIdentityAttributes = (displayName: string | undefined) =>
  displayName !== undefined
    ? {
        displayName,
      }
    : undefined;

type UpdateIdentityUserFn = (externalId: string, input: UpdateIdentityUserInput) => Promise<void>;

export const createProfileUpdateAttemptState = (): ProfileUpdateAttemptState => ({
  existing_profile_loaded: false,
  identity_provider_resolved: false,
  identity_sync_attempted: false,
  identity_sync_succeeded: false,
  local_db_write_attempted: false,
  local_db_write_succeeded: false,
  compensation_attempted: false,
  compensation_succeeded: false,
  projected_detail_resolved: false,
  failure_stage: 'load_existing_profile',
});

export const applyIdentityProviderResolutionToAttemptState = (
  attemptState: ProfileUpdateAttemptState,
  identityProviderResolution: ResolvedTenantIdentityProvider
): void => {
  attemptState.identity_provider_resolved = true;
  attemptState.provider_realm = identityProviderResolution.realm;
  attemptState.provider_admin_realm = identityProviderResolution.adminRealm;
  attemptState.provider_client_id = identityProviderResolution.clientId;
  attemptState.provider_source = identityProviderResolution.source;
  attemptState.provider_execution_mode = identityProviderResolution.executionMode;
};

const syncIdentityProfile = async (
  existingDetail: Awaited<ReturnType<typeof loadMyProfileDetail>>,
  keycloakSubject: string,
  payload: ProfileUpdatePayload,
  updateUser: UpdateIdentityUserFn
): Promise<void> =>
  trackKeycloakCall('update_my_profile', () =>
    updateUser(keycloakSubject, {
      username: payload.username ?? existingDetail?.username,
      email: payload.email ?? existingDetail?.email,
      firstName: payload.firstName ?? existingDetail?.firstName,
      lastName: payload.lastName ?? existingDetail?.lastName,
      attributes: buildIdentityAttributes(payload.displayName),
    })
  );

const restoreIdentityProfile = async (
  actor: ActorInfo,
  existingDetail: Awaited<ReturnType<typeof loadMyProfileDetail>>,
  updateUser: UpdateIdentityUserFn
): Promise<boolean> => {
  if (!existingDetail) {
    return false;
  }

  try {
    await trackKeycloakCall('update_my_profile_compensation', () =>
      updateUser(existingDetail.keycloakSubject, {
        username: existingDetail.username,
        email: existingDetail.email,
        firstName: existingDetail.firstName,
        lastName: existingDetail.lastName,
        attributes: {
          displayName: existingDetail.displayName,
        },
      })
    );
    return true;
  } catch (compensationError) {
    logger.error('IAM profile update compensation failed', {
      operation: 'update_my_profile_compensation',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      keycloak_subject: existingDetail.keycloakSubject,
      error:
        compensationError instanceof Error ? compensationError.message : String(compensationError),
    });
    return false;
  }
};

export const runProfileUpdateMutation = async (input: {
  actor: ActorInfo;
  dbKeycloakSubject: string;
  existingDetail: NonNullable<Awaited<ReturnType<typeof loadMyProfileDetail>>>;
  payload: ProfileUpdatePayload;
  attemptState: ProfileUpdateAttemptState;
  updateUser: UpdateIdentityUserFn;
}): Promise<Response> => {
  const shouldUpdateIdentity = shouldUpdateIdentityProfile(input.payload);

  try {
    if (shouldUpdateIdentity) {
      input.attemptState.failure_stage = 'identity_sync';
      input.attemptState.identity_sync_attempted = true;
      await syncIdentityProfile(
        input.existingDetail,
        input.existingDetail.keycloakSubject,
        input.payload,
        input.updateUser
      );
      input.attemptState.identity_sync_succeeded = true;
    }

    input.attemptState.failure_stage = 'local_persistence';
    input.attemptState.local_db_write_attempted = true;
    const detail = await updateMyProfileDetail(input.actor, input.dbKeycloakSubject, input.payload);
    input.attemptState.local_db_write_succeeded = true;
    if (!detail) {
      return createProfileNotFoundResponse(input.actor.requestId);
    }

    input.attemptState.failure_stage = 'projection';
    const projectedDetail = await resolveProjectedProfileDetail({
      instanceId: input.actor.instanceId,
      user: detail,
    });
    input.attemptState.projected_detail_resolved = true;

    iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(projectedDetail, input.actor.requestId));
  } catch (error) {
    if (shouldUpdateIdentity && input.attemptState.identity_sync_succeeded) {
      input.attemptState.compensation_attempted = true;
      input.attemptState.compensation_succeeded = await restoreIdentityProfile(
        input.actor,
        input.existingDetail,
        input.updateUser
      );
    }

    throw error;
  }
};
