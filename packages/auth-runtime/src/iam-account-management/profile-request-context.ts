import { getWorkspaceContext } from '@sva/server-runtime';
import type { ApiErrorCode, IamUserDetail, IamUserRoleAssignment } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

import { createApiError, parseRequestBody } from './api-helpers.js';
import { PLATFORM_PROFILE_ROLES, PLATFORM_ROLE_LEVEL_BY_NAME } from './constants.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import type { ProfileUpdatePayload } from './profile-commands.js';
import { consumeRateLimit } from './rate-limit.js';
import { logger, resolveActorInfo } from './shared.js';
import { validateCsrf } from './csrf.js';
import { updateMyProfileSchema } from './schemas.js';
import type { ActorInfo } from './types.js';

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
  'feature_gate' | 'actor_resolution' | 'rate_limit' | 'load_profile_detail';

type ProfileDiagnosticResponseBody = {
  error?: {
    code?: string;
    details?: Readonly<Record<string, unknown>>;
    message?: string;
  };
  requestId?: string;
};
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
    roleLevel: PLATFORM_ROLE_LEVEL_BY_NAME[roleName] ?? 0,
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
  isTechnicalAccount: false,
  roles: buildPlatformRoleAssignments(ctx.user.roles),
  mainserverUserApplicationSecretSet: false,
});

const isProfileDiagnosticsEnabled = (): boolean => process.env.IAM_DEBUG_PROFILE_ERRORS === 'true';

export const buildProfileDiagnosticDetails = (
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

    return createApiError(response.status, code, message, payload.requestId, {
      ...errorPayload.details,
      ...buildProfileDiagnosticDetails(ctx, stage, actor, extraDetails),
    });
  } catch {
    return response;
  }
};

export const resolvePlatformProfileRead = async (
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

const resolvePlatformProfileWrite = (ctx: AuthenticatedRequestContext): Response | null => {
  if (!canUsePlatformSelfServiceProfile(ctx)) {
    return null;
  }

  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  return createApiError(
    403,
    'forbidden',
    'Plattform-Profile können nicht über den tenantlokalen Profilpfad aktualisiert werden.',
    requestContext.requestId,
    {
      reason_code: 'platform_profile_write_not_supported',
      scope_kind: 'platform',
    }
  );
};

export const resolveProfileActorContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  scope: 'read' | 'write',
  options?: { validateWriteCsrf?: boolean }
): Promise<ProfileActorContext | Response> => {
  if (scope === 'write') {
    const platformWrite = resolvePlatformProfileWrite(ctx);
    if (platformWrite) {
      return platformWrite;
    }
  }

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
      ? await enrichProfileDiagnosticResponse(rateLimit, ctx, 'rate_limit', actorResolution.actor)
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

export const readProfileUpdatePayload = async (
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
