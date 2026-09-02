import { createHash } from 'node:crypto';

import { classifyTenantKeycloakRole, isTenantKeycloakRoleVisible } from '@sva/iam-admin';
import type {
  IamKeycloakRealmRoleAssignment,
  IamKeycloakRoleAssignmentMutationResult,
  IamUserKeycloakRoleAssignments,
} from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import type { IdentityProviderPort, IdentityRole } from '../identity-provider-port.js';
import { jsonResponse, type QueryClient } from '../db.js';

import { asApiItem, createApiError, parseRequestBody, readPathSegment } from './api-helpers.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';
import { emitActivityLog } from './shared-activity.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProviderForInstance, withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserReadAccess } from './user-read-shared.js';

const roleMutationSchema = z.object({
  roleName: z.string().trim().min(1).max(255),
  operation: z.enum(['assign', 'remove']),
});

type RoleMutationPayload = z.infer<typeof roleMutationSchema>;

type ResolvedTarget = {
  readonly externalId: string;
  readonly mappingStatus: 'mapped' | 'unmapped';
};

const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);

const readManagedBy = (role: IdentityRole): 'studio' | 'external' | 'keycloak_builtin' => {
  const policy = classifyTenantKeycloakRole(role);
  if (policy.category === 'keycloak_builtin') {
    return 'keycloak_builtin';
  }
  return role.attributes?.managed_by?.[0] === 'studio' ? 'studio' : 'external';
};

export const projectKeycloakRoleAssignments = (input: {
  readonly catalog: readonly IdentityRole[];
  readonly direct: readonly IdentityRole[];
  readonly effective: readonly IdentityRole[];
}): readonly IamKeycloakRealmRoleAssignment[] => {
  const directNames = new Set(input.direct.map((role) => role.externalName));
  const effectiveNames = new Set(input.effective.map((role) => role.externalName));

  return input.catalog
    .filter(isTenantKeycloakRoleVisible)
    .map((role): IamKeycloakRealmRoleAssignment => {
      const policy = classifyTenantKeycloakRole(role);
      const direct = directNames.has(role.externalName);
      const effective = effectiveNames.has(role.externalName);
      return {
        id: role.id ?? role.externalName,
        roleName: role.externalName,
        ...(role.description ? { description: role.description } : {}),
        composite: role.composite === true,
        managedBy: readManagedBy(role),
        category: policy.category,
        assignable: policy.assignable,
        direct,
        effective,
        origin: direct ? 'direct' : effective ? 'composite' : 'unassigned',
        ...(policy.reasonCode ? { reasonCode: policy.reasonCode } : {}),
      };
    })
    .sort((left, right) => left.roleName.localeCompare(right.roleName));
};

export const resolveKeycloakRoleMutationDelta = (input: {
  readonly operation: 'assign' | 'remove';
  readonly roleName: string;
  readonly direct: readonly IdentityRole[];
  readonly effective: readonly IdentityRole[];
}): { readonly needsWrite: boolean; readonly inheritedOnly: boolean } => {
  const direct = input.direct.some((entry) => entry.externalName === input.roleName);
  const effective = input.effective.some((entry) => entry.externalName === input.roleName);
  return {
    needsWrite: input.operation === 'assign' ? !direct : direct,
    inheritedOnly: input.operation === 'remove' && !direct && effective,
  };
};

const readUserRef = (request: Request, requestId?: string): string | Response => {
  const userRef = readPathSegment(request, 4)?.trim();
  if (!userRef || userRef.length > 512) {
    return createApiError(400, 'invalid_request', 'Ungültige Benutzerreferenz.', requestId);
  }
  return userRef;
};

const resolveTarget = async (
  client: QueryClient,
  instanceId: string,
  userRef: string
): Promise<ResolvedTarget | null> => {
  if (userRef.startsWith('keycloak:')) {
    const externalId = userRef.slice('keycloak:'.length).trim();
    return externalId ? { externalId, mappingStatus: 'unmapped' } : null;
  }

  if (!z.string().uuid().safeParse(userRef).success) {
    return null;
  }

  const result = await client.query<{ keycloak_subject: string }>(
    `
SELECT keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [instanceId, userRef]
  );
  const externalId = result.rows[0]?.keycloak_subject;
  return externalId ? { externalId, mappingStatus: 'mapped' } : null;
};

const requireProvider = async (instanceId: string, requestId?: string) => {
  const resolved = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!resolved) {
    return createApiError(
      409,
      'tenant_admin_client_not_configured',
      'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
      requestId,
      { reason_code: 'tenant_admin_client_not_configured' }
    );
  }
  return resolved.provider;
};

const verifyTargetExists = async (
  provider: IdentityProviderPort,
  externalId: string,
  requestId?: string
): Promise<Response | null> => {
  try {
    await trackKeycloakCall('keycloak_role_target_lookup', () =>
      provider.getUserAttributes(externalId, [])
    );
    return null;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
      return createApiError(
        404,
        'not_found',
        'Benutzer wurde im Tenant-Realm nicht gefunden.',
        requestId
      );
    }
    throw error;
  }
};

const loadAssignments = async (provider: IdentityProviderPort, externalId: string) => {
  const listUserRealmRoleAssignments = provider.listUserRealmRoleAssignments;
  if (listUserRealmRoleAssignments) {
    return trackKeycloakCall('list_user_keycloak_role_assignments', () =>
      listUserRealmRoleAssignments.call(provider, externalId)
    );
  }

  const directNames = await trackKeycloakCall('list_user_keycloak_role_names', () =>
    provider.listUserRoleNames(externalId)
  );
  const roles = await trackKeycloakCall('list_keycloak_roles_for_user_fallback', () =>
    provider.listRoles()
  );
  const direct = roles.filter((role) => directNames.includes(role.externalName));
  return { direct, effective: direct };
};

const projectAssignments = async (
  provider: IdentityProviderPort,
  userRef: string,
  target: ResolvedTarget
): Promise<IamUserKeycloakRoleAssignments> => {
  const [catalog, assignments] = await Promise.all([
    trackKeycloakCall('list_keycloak_role_catalog_for_user', () => provider.listRoles()),
    loadAssignments(provider, target.externalId),
  ]);
  const roles = projectKeycloakRoleAssignments({
    catalog,
    direct: assignments.direct,
    effective: assignments.effective,
  });

  return { userRef, mappingStatus: target.mappingStatus, roles };
};

const createDependencyError = (requestId?: string): Response =>
  createApiError(
    503,
    'keycloak_unavailable',
    'Die Verbindung zu Keycloak ist derzeit nicht verfügbar.',
    requestId,
    { dependency: 'keycloak' }
  );

export const getUserKeycloakRolesInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const access = await resolveUserReadAccess(request, ctx);
  const accessError = 'response' in access ? access.response : undefined;
  if (accessError) {
    return accessError;
  }
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
  const userRef = readUserRef(request, requestContext.requestId);
  if (userRef instanceof Response) {
    return userRef;
  }

  try {
    const target = await withInstanceScopedDb(readActor.instanceId, (client) =>
      resolveTarget(client, readActor.instanceId, userRef)
    );
    if (!target) {
      return createApiError(404, 'not_found', 'Benutzer nicht gefunden.', requestContext.requestId);
    }
    const provider = await requireProvider(readActor.instanceId, requestContext.requestId);
    if (provider instanceof Response) {
      return provider;
    }
    const targetError = await verifyTargetExists(
      provider,
      target.externalId,
      requestContext.requestId
    );
    if (targetError) {
      return targetError;
    }
    return jsonResponse(
      200,
      asApiItem(await projectAssignments(provider, userRef, target), requestContext.requestId)
    );
  } catch (error) {
    logger.warn('Keycloak role assignments could not be loaded', {
      operation: 'get_user_keycloak_roles',
      instance_id: readActor.instanceId,
      error_type: error instanceof Error ? error.name : typeof error,
      request_id: requestContext.requestId,
    });
    return createDependencyError(requestContext.requestId);
  }
};

const auditMutation = async (input: {
  instanceId: string;
  actorAccountId: string;
  targetExternalId: string;
  payload: RoleMutationPayload;
  result: 'success' | 'failure';
  outcome: string;
  requestId?: string;
  traceId?: string;
}) =>
  withInstanceScopedDb(input.instanceId, (client) =>
    emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'keycloak.role_assignment.changed',
      result: input.result,
      payload: {
        operation: input.payload.operation,
        role_name: input.payload.roleName,
        outcome: input.outcome,
        target_ref: createHash('sha256').update(input.targetExternalId).digest('hex'),
      },
      requestId: input.requestId,
      traceId: input.traceId,
    })
  );

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
  if ('response' in actorResolution) {
    return actorResolution.response;
  }
  const parsed = await parseRequestBody(request, roleMutationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestContext.requestId);
  }
  const userRef = readUserRef(request, requestContext.requestId);
  if (userRef instanceof Response) {
    return userRef;
  }
  const actor = actorResolution.actor;

  try {
    const target = await withInstanceScopedDb(actor.instanceId, (client) =>
      resolveTarget(client, actor.instanceId, userRef)
    );
    if (!target) {
      return createApiError(404, 'not_found', 'Benutzer nicht gefunden.', requestContext.requestId);
    }
    const provider = await requireProvider(actor.instanceId, requestContext.requestId);
    if (provider instanceof Response) {
      return provider;
    }
    const targetError = await verifyTargetExists(
      provider,
      target.externalId,
      requestContext.requestId
    );
    if (targetError) {
      return targetError;
    }
    const role = await trackKeycloakCall('get_keycloak_role_for_assignment', () =>
      provider.getRoleByName(parsed.data.roleName)
    );
    if (!role || role.clientRole === true) {
      return createApiError(
        404,
        'not_found',
        'Realm-Rolle nicht gefunden.',
        requestContext.requestId
      );
    }
    const policy = classifyTenantKeycloakRole(role);
    if (!policy.assignable) {
      await auditMutation({
        instanceId: actor.instanceId,
        actorAccountId: actor.actorAccountId,
        targetExternalId: target.externalId,
        payload: parsed.data,
        result: 'failure',
        outcome: policy.reasonCode ?? policy.category,
        requestId: requestContext.requestId,
        traceId: requestContext.traceId,
      });
      return createApiError(
        policy.category === 'system_admin' ? 409 : 422,
        'keycloak_role_protected',
        policy.category === 'system_admin'
          ? 'system_admin muss über die geschützte lokale IAM-Rollenzuweisung verwaltet werden.'
          : 'Diese Keycloak-Rolle kann im Tenant-Studio nicht zugewiesen werden.',
        requestContext.requestId,
        { reason_code: policy.reasonCode ?? policy.category }
      );
    }
    const assignRealmRoles = provider.assignRealmRoles;
    const removeRealmRoles = provider.removeRealmRoles;
    if (!assignRealmRoles || !removeRealmRoles) {
      return createApiError(
        409,
        'tenant_admin_client_not_configured',
        'Der Identity Provider unterstützt keine Realm-Rollenzuweisungen.',
        requestContext.requestId
      );
    }

    const before = await loadAssignments(provider, target.externalId);
    const delta = resolveKeycloakRoleMutationDelta({
      operation: parsed.data.operation,
      roleName: role.externalName,
      direct: before.direct,
      effective: before.effective,
    });
    if (delta.inheritedOnly) {
      await auditMutation({
        instanceId: actor.instanceId,
        actorAccountId: actor.actorAccountId,
        targetExternalId: target.externalId,
        payload: parsed.data,
        result: 'failure',
        outcome: 'inherited_role_assignment',
        requestId: requestContext.requestId,
        traceId: requestContext.traceId,
      });
      return createApiError(
        409,
        'keycloak_role_assignment_not_direct',
        'Die Rolle ist geerbt und kann nur über ihre direkte Composite-Zuweisung entfernt werden.',
        requestContext.requestId,
        { reason_code: 'inherited_role_assignment' }
      );
    }

    const needsWrite = delta.needsWrite;
    let writeFailed = false;
    if (needsWrite) {
      try {
        await trackKeycloakCall(`keycloak_role_${parsed.data.operation}`, () =>
          parsed.data.operation === 'assign'
            ? assignRealmRoles.call(provider, target.externalId, [role.externalName])
            : removeRealmRoles.call(provider, target.externalId, [role.externalName])
        );
      } catch {
        writeFailed = true;
      }
    }

    const after = await loadAssignments(provider, target.externalId);
    const isDirect = after.direct.some((entry) => entry.externalName === role.externalName);
    const confirmed = parsed.data.operation === 'assign' ? isDirect : !isDirect;
    const result: IamKeycloakRoleAssignmentMutationResult = {
      userRef,
      roleName: role.externalName,
      operation: parsed.data.operation,
      direct: isDirect,
      status: confirmed ? 'confirmed' : 'reconciliation_required',
    };

    await auditMutation({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      targetExternalId: target.externalId,
      payload: parsed.data,
      result: confirmed ? 'success' : 'failure',
      outcome: confirmed
        ? needsWrite
          ? 'confirmed'
          : 'idempotent_noop'
        : 'reconciliation_required',
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
    });

    if (!confirmed) {
      return createApiError(
        409,
        'keycloak_role_assignment_reconciliation_required',
        'Die Keycloak-Rollenzuweisung konnte nicht eindeutig bestätigt werden.',
        requestContext.requestId,
        {
          reason_code: writeFailed
            ? 'write_failed_state_unconfirmed'
            : 'post_write_state_unconfirmed',
        }
      );
    }
    return jsonResponse(200, asApiItem(result, requestContext.requestId));
  } catch (error) {
    logger.error('Keycloak role assignment failed', {
      operation: 'mutate_user_keycloak_role',
      instance_id: actor.instanceId,
      error_type: error instanceof Error ? error.name : typeof error,
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
    });
    return createDependencyError(requestContext.requestId);
  }
};
