import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';
import { logger } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import {
  createKeycloakRoleOperationError,
  projectUserKeycloakRoleAssignments,
  readKeycloakRoleUserRef,
  requireKeycloakRoleProvider,
  resolveKeycloakRoleTarget,
  roleMutationSchema,
  verifyKeycloakRoleTarget,
} from './user-keycloak-role-assignments.js';
import { executeKeycloakRoleMutation } from './user-keycloak-role-mutation.js';
import { resolveUserReadAccess } from './user-read-shared.js';

export {
  projectKeycloakRoleAssignments,
  resolveKeycloakRoleMutationDelta,
} from './user-keycloak-role-assignments.js';

const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);

export const getUserKeycloakRolesInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const access = await resolveUserReadAccess(request, ctx);
  const accessError = 'response' in access ? access.response : undefined;
  if (accessError) return accessError;
  const readActor = access.actor;
  if (!readActor) {
    return createApiError(403, 'forbidden', 'Akteur konnte nicht aufgelöst werden.');
  }

  const requestContext = getWorkspaceContext();
  const roleAccess = await authorizeInstancePermissionForUser({
    ctx,
    action: 'iam.role.read',
    instanceId: readActor.instanceId,
  });
  if (!roleAccess.ok) {
    return createApiError(
      roleAccess.status,
      toInstancePermissionApiErrorCode(roleAccess.error),
      roleAccess.message,
      requestContext.requestId,
      roleAccess.permissionDenial
    );
  }
  const userRef = readKeycloakRoleUserRef(request, requestContext.requestId);
  if (userRef instanceof Response) return userRef;

  try {
    const target = await withInstanceScopedDb(readActor.instanceId, (client) =>
      resolveKeycloakRoleTarget(client, readActor.instanceId, userRef)
    );
    if (!target) {
      return createApiError(404, 'not_found', 'Benutzer nicht gefunden.', requestContext.requestId);
    }
    const provider = await requireKeycloakRoleProvider(
      readActor.instanceId,
      requestContext.requestId
    );
    if (provider instanceof Response) return provider;
    const targetError = await verifyKeycloakRoleTarget(
      provider,
      target.externalId,
      requestContext.requestId
    );
    if (targetError) return targetError;
    const assignments = await projectUserKeycloakRoleAssignments(provider, userRef, target);
    return jsonResponse(200, asApiItem(assignments, requestContext.requestId));
  } catch (error) {
    logger.warn('Keycloak role assignments could not be loaded', {
      operation: 'get_user_keycloak_roles',
      instance_id: readActor.instanceId,
      error_type: error instanceof Error ? error.name : typeof error,
      request_id: requestContext.requestId,
    });
    return createKeycloakRoleOperationError(error, requestContext.requestId);
  }
};

export const mutateUserKeycloakRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const actorResolution = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: SYSTEM_ADMIN_ROLES,
    requiredPermissionAction: 'iam.role.write',
    feature: 'iam_admin',
    scope: 'write',
    requestId: requestContext.requestId,
  });
  if ('response' in actorResolution) return actorResolution.response;
  const parsed = await parseRequestBody(request, roleMutationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestContext.requestId);
  }
  const userRef = readKeycloakRoleUserRef(request, requestContext.requestId);
  if (userRef instanceof Response) return userRef;
  const actor = actorResolution.actor;

  try {
    const target = await withInstanceScopedDb(actor.instanceId, (client) =>
      resolveKeycloakRoleTarget(client, actor.instanceId, userRef)
    );
    if (!target) {
      return createApiError(404, 'not_found', 'Benutzer nicht gefunden.', requestContext.requestId);
    }
    const provider = await requireKeycloakRoleProvider(actor.instanceId, requestContext.requestId);
    if (provider instanceof Response) return provider;
    const targetError = await verifyKeycloakRoleTarget(
      provider,
      target.externalId,
      requestContext.requestId
    );
    if (targetError) return targetError;
    return executeKeycloakRoleMutation({
      provider,
      actor,
      target,
      userRef,
      payload: parsed.data,
      metadata: { requestId: requestContext.requestId, traceId: requestContext.traceId },
    });
  } catch (error) {
    logger.error('Keycloak role assignment failed', {
      operation: 'mutate_user_keycloak_role',
      instance_id: actor.instanceId,
      error_type: error instanceof Error ? error.name : typeof error,
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
    });
    return createKeycloakRoleOperationError(error, requestContext.requestId);
  }
};
