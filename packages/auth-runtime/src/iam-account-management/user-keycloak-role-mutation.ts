import { createHash } from 'node:crypto';

import { classifyTenantKeycloakRole } from '@sva/iam-admin';
import type { IamKeycloakRoleAssignmentMutationResult } from '@sva/core';

import type { IdentityProviderPort, IdentityRole } from '../identity-provider-port.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { emitActivityLog } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import {
  loadKeycloakRoleAssignments,
  resolveKeycloakRoleMutationDelta,
  type ResolvedKeycloakRoleTarget,
  type RoleMutationPayload,
} from './user-keycloak-role-assignments.js';

type MutationActor = { readonly instanceId: string; readonly actorAccountId: string };
type RequestMetadata = { readonly requestId?: string; readonly traceId?: string };
type RoleWriters = {
  readonly assign: NonNullable<IdentityProviderPort['assignRealmRoles']>;
  readonly remove: NonNullable<IdentityProviderPort['removeRealmRoles']>;
};

const auditMutation = async (input: {
  actor: MutationActor;
  targetExternalId: string;
  payload: RoleMutationPayload;
  result: 'success' | 'failure';
  outcome: string;
  metadata: RequestMetadata;
}) =>
  withInstanceScopedDb(input.actor.instanceId, (client) =>
    emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'keycloak.role_assignment.changed',
      result: input.result,
      payload: {
        operation: input.payload.operation,
        role_name: input.payload.roleName,
        outcome: input.outcome,
        target_ref: createHash('sha256').update(input.targetExternalId).digest('hex'),
      },
      requestId: input.metadata.requestId,
      traceId: input.metadata.traceId,
    })
  );

const resolveRole = async (
  provider: IdentityProviderPort,
  roleName: string,
  requestId?: string
): Promise<IdentityRole | Response> => {
  const role = await trackKeycloakCall('get_keycloak_role_for_assignment', () =>
    provider.getRoleByName(roleName)
  );
  return role && role.clientRole !== true
    ? role
    : createApiError(404, 'not_found', 'Realm-Rolle nicht gefunden.', requestId);
};

const rejectProtectedRole = async (input: {
  role: IdentityRole;
  actor: MutationActor;
  target: ResolvedKeycloakRoleTarget;
  payload: RoleMutationPayload;
  metadata: RequestMetadata;
}): Promise<Response | null> => {
  const policy = classifyTenantKeycloakRole(input.role);
  if (policy.assignable) return null;
  await auditMutation({
    actor: input.actor,
    targetExternalId: input.target.externalId,
    payload: input.payload,
    result: 'failure',
    outcome: policy.reasonCode ?? policy.category,
    metadata: input.metadata,
  });
  return createApiError(
    policy.category === 'system_admin' ? 409 : 422,
    'keycloak_role_protected',
    policy.category === 'system_admin'
      ? 'system_admin muss über die geschützte lokale IAM-Rollenzuweisung verwaltet werden.'
      : 'Diese Keycloak-Rolle kann im Tenant-Studio nicht zugewiesen werden.',
    input.metadata.requestId,
    { reason_code: policy.reasonCode ?? policy.category }
  );
};

const requireRoleWriters = (
  provider: IdentityProviderPort,
  requestId?: string
): RoleWriters | Response => {
  const assign = provider.assignRealmRoles;
  const remove = provider.removeRealmRoles;
  return assign && remove
    ? { assign, remove }
    : createApiError(
        409,
        'tenant_admin_client_not_configured',
        'Der Identity Provider unterstützt keine Realm-Rollenzuweisungen.',
        requestId
      );
};

const rejectInheritedMutation = async (input: {
  inheritedOnly: boolean;
  actor: MutationActor;
  target: ResolvedKeycloakRoleTarget;
  payload: RoleMutationPayload;
  metadata: RequestMetadata;
}): Promise<Response | null> => {
  if (!input.inheritedOnly) return null;
  await auditMutation({
    actor: input.actor,
    targetExternalId: input.target.externalId,
    payload: input.payload,
    result: 'failure',
    outcome: 'inherited_role_assignment',
    metadata: input.metadata,
  });
  return createApiError(
    409,
    'keycloak_role_assignment_not_direct',
    'Die Rolle ist geerbt und kann nur über ihre direkte Composite-Zuweisung entfernt werden.',
    input.metadata.requestId,
    { reason_code: 'inherited_role_assignment' }
  );
};

const writeRoleDelta = async (input: {
  needsWrite: boolean;
  provider: IdentityProviderPort;
  writers: RoleWriters;
  targetExternalId: string;
  roleName: string;
  operation: RoleMutationPayload['operation'];
}): Promise<boolean> => {
  if (!input.needsWrite) return false;
  try {
    await trackKeycloakCall(`keycloak_role_${input.operation}`, () =>
      input.operation === 'assign'
        ? input.writers.assign.call(input.provider, input.targetExternalId, [input.roleName])
        : input.writers.remove.call(input.provider, input.targetExternalId, [input.roleName])
    );
    return false;
  } catch {
    return true;
  }
};

const createMutationResult = (input: {
  userRef: string;
  roleName: string;
  operation: RoleMutationPayload['operation'];
  direct: boolean;
  confirmed: boolean;
}): IamKeycloakRoleAssignmentMutationResult => ({
  userRef: input.userRef,
  roleName: input.roleName,
  operation: input.operation,
  direct: input.direct,
  status: input.confirmed ? 'confirmed' : 'reconciliation_required',
});

export const executeKeycloakRoleMutation = async (input: {
  provider: IdentityProviderPort;
  actor: MutationActor;
  target: ResolvedKeycloakRoleTarget;
  userRef: string;
  payload: RoleMutationPayload;
  metadata: RequestMetadata;
}): Promise<Response> => {
  const role = await resolveRole(input.provider, input.payload.roleName, input.metadata.requestId);
  if (role instanceof Response) return role;
  const protectedError = await rejectProtectedRole({ ...input, role });
  if (protectedError) return protectedError;
  const writers = requireRoleWriters(input.provider, input.metadata.requestId);
  if (writers instanceof Response) return writers;

  const before = await loadKeycloakRoleAssignments(input.provider, input.target.externalId);
  const delta = resolveKeycloakRoleMutationDelta({
    operation: input.payload.operation,
    roleName: role.externalName,
    direct: before.direct,
    effective: before.effective,
  });
  const inheritedError = await rejectInheritedMutation({ ...input, ...delta });
  if (inheritedError) return inheritedError;
  const writeFailed = await writeRoleDelta({
    needsWrite: delta.needsWrite,
    provider: input.provider,
    writers,
    targetExternalId: input.target.externalId,
    roleName: role.externalName,
    operation: input.payload.operation,
  });

  const after = await loadKeycloakRoleAssignments(input.provider, input.target.externalId);
  const direct = after.direct.some((entry) => entry.externalName === role.externalName);
  const confirmed = input.payload.operation === 'assign' ? direct : !direct;
  const result = createMutationResult({
    userRef: input.userRef,
    roleName: role.externalName,
    operation: input.payload.operation,
    direct,
    confirmed,
  });
  await auditMutation({
    actor: input.actor,
    targetExternalId: input.target.externalId,
    payload: input.payload,
    result: confirmed ? 'success' : 'failure',
    outcome: confirmed
      ? delta.needsWrite
        ? 'confirmed'
        : 'idempotent_noop'
      : 'reconciliation_required',
    metadata: input.metadata,
  });

  return confirmed
    ? jsonResponse(200, asApiItem(result, input.metadata.requestId))
    : createApiError(
        409,
        'keycloak_role_assignment_reconciliation_required',
        'Die Keycloak-Rollenzuweisung konnte nicht eindeutig bestätigt werden.',
        input.metadata.requestId,
        {
          reason_code: writeFailed
            ? 'write_failed_state_unconfirmed'
            : 'post_write_state_unconfirmed',
        }
      );
};
