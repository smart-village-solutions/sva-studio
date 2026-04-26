import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { isUuid } from '../shared/input-readers.js';

import { ADMIN_ROLES } from './constants.js';
import { createApiError, readPathSegment } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { requireRoles, resolveActorInfo } from './shared.js';

export type UserReadActor = {
  instanceId: string;
  requestId?: string;
  traceId?: string;
};

export const resolveUserReadAccess = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { response: featureCheck } as const;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { response: roleCheck } as const;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return { response: actorResolution.error } as const;
  }
  return { actor: actorResolution.actor } as const;
};

export const readValidatedUserId = (request: Request, requestId?: string) => {
  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return { response: createApiError(400, 'invalid_request', 'Ungültige userId.', requestId) } as const;
  }

  return { userId } as const;
};

export const createDatabaseApiError = (error: unknown, requestId?: string) => {
  const classified = classifyIamDiagnosticError(error, 'IAM-Datenbank ist nicht erreichbar.', requestId);
  return createApiError(classified.status, classified.code, classified.message, requestId, classified.details);
};

const stringifySettledError = (result: PromiseSettledResult<unknown>): string | undefined => {
  if (result.status !== 'rejected') {
    return undefined;
  }

  return result.reason instanceof Error ? result.reason.message : String(result.reason);
};

export const logUserProjectionDegraded = (input: {
  actor: UserReadActor;
  userId: string;
  keycloakRoleNamesResult: PromiseSettledResult<readonly string[] | null>;
  mainserverCredentialStateResult: PromiseSettledResult<{
    mainserverUserApplicationId?: string;
    mainserverUserApplicationSecretSet: boolean;
  }>;
  logger: {
    warn: (message: string, meta: Record<string, unknown>) => void;
  };
}) => {
  if (input.keycloakRoleNamesResult.status !== 'rejected' && input.mainserverCredentialStateResult.status !== 'rejected') {
    return;
  }

  input.logger.warn('IAM user detail projection degraded because external data could not be loaded', {
    operation: 'get_user',
    instance_id: input.actor.instanceId,
    user_id: input.userId,
    request_id: input.actor.requestId,
    trace_id: input.actor.traceId,
    keycloak_roles_error: stringifySettledError(input.keycloakRoleNamesResult),
    mainserver_credentials_error: stringifySettledError(input.mainserverCredentialStateResult),
  });
};
