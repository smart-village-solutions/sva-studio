import { getWorkspaceContext } from '@sva/sdk/server';
import type { ApiErrorCode, IamUserDetail, IamUserRoleAssignment } from '@sva/core';

import type { UpdateIdentityUserInput } from '../identity-provider-port.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import {
  loadMyProfileDetail,
  type ProfileUpdatePayload,
  updateMyProfileDetail,
} from './profile-commands.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  iamUserOperationsCounter,
  logger,
  resolveActorInfo,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { runCriticalIamSchemaGuard } from './schema-guard.js';
import { validateCsrf } from './csrf.js';
import { updateMyProfileSchema } from './schemas.js';
import type { ActorInfo } from './types.js';
import { applyCanonicalUserDetailProjection } from './user-projection.js';

type ProfileActorContext = {
  actor: ActorInfo;
  dbKeycloakSubject: string;
  sessionProfile: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
};

type ProfileDiagnosticsStage =
  | 'feature_gate'
  | 'actor_resolution'
  | 'rate_limit'
  | 'load_profile_detail';

type ProfileDiagnosticResponseBody = {
  error?: {
    code?: string;
    details?: Readonly<Record<string, unknown>>;
    message?: string;
  };
  requestId?: string;
};

const PLATFORM_PROFILE_ROLES = new Set(['system_admin', 'instance_registry_admin']);

const deriveSessionDisplayName = (ctx: AuthenticatedRequestContext): string =>
  ctx.user.displayName?.trim() ||
  [ctx.user.firstName?.trim(), ctx.user.lastName?.trim()].filter(Boolean).join(' ').trim() ||
  ctx.user.username?.trim() ||
  ctx.user.id;

const buildPlatformRoleAssignments = (roles: readonly string[]): readonly IamUserRoleAssignment[] =>
  [...new Set(roles.filter((role) => PLATFORM_PROFILE_ROLES.has(role)))].map((roleName) => ({
    roleId: `platform:${roleName}`,
    roleKey: roleName,
    roleName,
    roleLevel: 0,
  }));

const canUsePlatformSelfServiceProfile = (ctx: AuthenticatedRequestContext): boolean =>
  !ctx.user.instanceId && ctx.user.roles.some((role) => PLATFORM_PROFILE_ROLES.has(role));

const buildPlatformProfileFromSession = (ctx: AuthenticatedRequestContext): IamUserDetail => ({
  id: `platform:${ctx.user.id}`,
  keycloakSubject: ctx.user.id,
  username: ctx.user.username,
  email: ctx.user.email,
  firstName: ctx.user.firstName,
  lastName: ctx.user.lastName,
  displayName: deriveSessionDisplayName(ctx),
  status: 'active',
  roles: buildPlatformRoleAssignments(ctx.user.roles),
  mainserverUserApplicationSecretSet: false,
});

const isProfileDiagnosticsEnabled = (): boolean => process.env.IAM_DEBUG_PROFILE_ERRORS === 'true';

const buildProfileDiagnosticDetails = (
  ctx: AuthenticatedRequestContext,
  stage: ProfileDiagnosticsStage,
  actor?: ActorInfo,
  extraDetails?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  diagnostic_stage: stage,
  session_user_id: ctx.user.id,
  session_instance_id: ctx.user.instanceId ?? null,
  session_roles: ctx.user.roles,
  session_roles_count: ctx.user.roles.length,
  ...(actor
    ? {
        actor_account_id: actor.actorAccountId ?? null,
        actor_account_id_present: Boolean(actor.actorAccountId),
        actor_instance_id: actor.instanceId,
      }
    : {}),
  ...extraDetails,
});

const enrichProfileDiagnosticResponse = async (
  response: Response,
  ctx: AuthenticatedRequestContext,
  stage: ProfileDiagnosticsStage,
  actor?: ActorInfo,
  extraDetails?: Readonly<Record<string, unknown>>
): Promise<Response> => {
  if (!isProfileDiagnosticsEnabled()) {
    return response;
  }

  try {
    const payload = (await response.clone().json()) as ProfileDiagnosticResponseBody;
    const errorPayload = payload.error;
    const code = errorPayload?.code as ApiErrorCode | undefined;
    const message = errorPayload?.message;
    if (!code || !message) {
      return response;
    }

    return createApiError(
      response.status,
      code,
      message,
      payload.requestId,
      {
        ...errorPayload.details,
        ...buildProfileDiagnosticDetails(ctx, stage, actor, extraDetails),
      }
    );
  } catch {
    return response;
  }
};

const resolvePlatformProfileRead = async (
  ctx: AuthenticatedRequestContext
): Promise<{ profile: IamUserDetail; requestId?: string } | null | Response> => {
  if (!canUsePlatformSelfServiceProfile(ctx)) {
    return null;
  }

  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return enrichProfileDiagnosticResponse(featureCheck, ctx, 'feature_gate');
  }

  return {
    profile: buildPlatformProfileFromSession(ctx),
    requestId: requestContext.requestId,
  };
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
    return scope === 'read'
      ? await enrichProfileDiagnosticResponse(featureCheck, ctx, 'feature_gate')
      : featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    logger.warn('IAM profile actor resolution failed', {
      operation: 'get_my_profile',
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
      session_user_id: ctx.user.id,
      session_instance_id: ctx.user.instanceId ?? null,
      session_roles_count: ctx.user.roles.length,
    });
    return scope === 'read'
      ? await enrichProfileDiagnosticResponse(actorResolution.error, ctx, 'actor_resolution')
      : actorResolution.error;
  }

  logger.info('IAM profile actor resolved', {
    operation: scope === 'read' ? 'get_my_profile' : 'update_my_profile',
    request_id: actorResolution.actor.requestId,
    trace_id: actorResolution.actor.traceId,
    session_user_id: ctx.user.id,
    session_instance_id: ctx.user.instanceId ?? null,
    session_roles_count: ctx.user.roles.length,
    actor_instance_id: actorResolution.actor.instanceId,
    actor_account_id_present: Boolean(actorResolution.actor.actorAccountId),
  });

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
    return scope === 'read'
      ? await enrichProfileDiagnosticResponse(
          rateLimit,
          ctx,
          'rate_limit',
          actorResolution.actor
        )
      : rateLimit;
  }

  return {
    actor: actorResolution.actor,
    dbKeycloakSubject: ctx.user.id,
    sessionProfile: {
      username: ctx.user.username,
      email: ctx.user.email,
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      displayName: ctx.user.displayName,
    },
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

const ensureIdentityProvider = async (instanceId: string, requestId?: string) => {
  const identityProvider = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
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
      }
    );
  }

  return identityProvider.provider;
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

type UpdateIdentityUserFn = (
  externalId: string,
  input: UpdateIdentityUserInput
) => Promise<void>;

const syncIdentityProfile = async (
  keycloakSubject: string,
  payload: ProfileUpdatePayload,
  updateUser: UpdateIdentityUserFn
): Promise<void> =>
  trackKeycloakCall('update_my_profile', () =>
    updateUser(keycloakSubject, {
      username: payload.username,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      attributes: buildIdentityAttributes(payload.displayName),
    })
  );

const restoreIdentityProfile = async (
  actor: ActorInfo,
  existingDetail: Awaited<ReturnType<typeof loadMyProfileDetail>>,
  updateUser: UpdateIdentityUserFn
): Promise<void> => {
  if (!existingDetail) {
    return;
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
  } catch (compensationError) {
    logger.error('IAM profile update compensation failed', {
      operation: 'update_my_profile_compensation',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      keycloak_subject: existingDetail.keycloakSubject,
      error: compensationError instanceof Error ? compensationError.message : String(compensationError),
    });
  }
};

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
  const classified = classifyIamDiagnosticError(error, 'Profil konnte nicht aktualisiert werden.', actor.requestId);
  if (classified.details.reason_code === 'pii_encryption_missing') {
    return createApiError(classified.status, classified.code, 'PII-Verschlüsselung ist nicht konfiguriert.', actor.requestId, classified.details);
  }

  logger.error('IAM profile update failed', {
    operation: 'update_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error: errorMessage,
  });
  iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'failure' });
  return createApiError(
    classified.status,
    classified.code,
    classified.message,
    actor.requestId,
    classified.details
  );
};

const buildSchemaDriftFallbackResponse = async (
  actor: ActorInfo,
  fallbackMessage: string,
): Promise<Response | undefined> => {
  try {
    const schemaGuard = await withInstanceScopedDb(actor.instanceId, (client) =>
      runCriticalIamSchemaGuard(client),
    );
    const failed = schemaGuard.checks.find((check) => !check.ok);
    if (!failed) {
      return undefined;
    }

    return createApiError(503, 'database_unavailable', fallbackMessage, actor.requestId, {
      dependency: 'database',
      expected_migration: failed.expectedMigration,
      instance_id: actor.instanceId,
      reason_code: 'schema_drift',
      schema_object: failed.schemaObject,
    });
  } catch {
    return undefined;
  }
};

const handleProfileFetchError = async (
  actor: ActorInfo,
  ctx: AuthenticatedRequestContext,
  error: unknown
): Promise<Response> => {
  const classified = classifyIamDiagnosticError(error, 'Profil konnte nicht geladen werden.', actor.requestId);
  const errorCause = error && typeof error === 'object' && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined;
  if (classified.details.reason_code === 'unexpected_internal_error') {
    const schemaDriftResponse = await buildSchemaDriftFallbackResponse(
      actor,
      'Profil konnte nicht geladen werden.',
    );
    if (schemaDriftResponse) {
      return schemaDriftResponse;
    }
  }

  logger.error('IAM profile fetch failed', {
    operation: 'get_my_profile',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
    error_cause:
      errorCause instanceof Error
        ? errorCause.message
        : errorCause !== undefined
          ? String(errorCause)
          : undefined,
    classified_status: classified.status,
    classified_code: classified.code,
    classified_reason_code: classified.details.reason_code,
  });
  iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'failure' });
  const debugDetails =
    process.env.IAM_DEBUG_PROFILE_ERRORS === 'true'
      ? {
          ...buildProfileDiagnosticDetails(ctx, 'load_profile_detail', actor),
          debug_error_type: error instanceof Error ? error.constructor.name : typeof error,
          debug_error_message: error instanceof Error ? error.message : String(error),
          debug_error_stack: error instanceof Error ? error.stack : undefined,
          debug_error_cause:
            errorCause instanceof Error
              ? errorCause.message
              : errorCause !== undefined
                ? String(errorCause)
                : undefined,
        }
      : undefined;
  return createApiError(
    classified.status,
    classified.code,
    classified.message,
    actor.requestId,
    debugDetails ? { ...classified.details, ...debugDetails } : classified.details
  );
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
    const existingDetail = await loadMyProfileDetail(
      actorContext.actor,
      actorContext.dbKeycloakSubject,
      actorContext.sessionProfile
    );
    if (!existingDetail) {
      return createProfileNotFoundResponse(actorContext.actor.requestId);
    }

    const identityProvider = await ensureIdentityProvider(
      actorContext.actor.instanceId,
      actorContext.actor.requestId
    );
    if (identityProvider instanceof Response) {
      return identityProvider;
    }

    const shouldUpdateIdentity = shouldUpdateIdentityProfile(payload.data);

    try {
      if (shouldUpdateIdentity) {
        await syncIdentityProfile(existingDetail.keycloakSubject, payload.data, identityProvider.updateUser.bind(identityProvider));
      }

      const detail = await updateMyProfileDetail(
        actorContext.actor,
        actorContext.dbKeycloakSubject,
        payload.data
      );
      if (!detail) {
        return createProfileNotFoundResponse(actorContext.actor.requestId);
      }

      const projectedDetail = await withInstanceScopedDb(actorContext.actor.instanceId, (client) =>
        applyCanonicalUserDetailProjection({
          client,
          instanceId: actorContext.actor.instanceId,
          user: detail,
        })
      );

      iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'success' });
      return jsonResponse(200, asApiItem(projectedDetail, actorContext.actor.requestId));
    } catch (error) {
      if (shouldUpdateIdentity) {
        await restoreIdentityProfile(
          actorContext.actor,
          existingDetail,
          identityProvider.updateUser.bind(identityProvider)
        );
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

    const projectedDetail = await withInstanceScopedDb(actorContext.actor.instanceId, (client) =>
      applyCanonicalUserDetailProjection({
        client,
        instanceId: actorContext.actor.instanceId,
        user: detail,
      })
    );

    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(projectedDetail, actorContext.actor.requestId));
  } catch (error) {
    return await handleProfileFetchError(actorContext.actor, ctx, error);
  }
};
