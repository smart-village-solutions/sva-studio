import type { ManagedRoleRow } from './types.js';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleById, loadRoleListItemById } from './role-query.js';
import { updateRoleSchema } from './schemas.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';
import { iamRoleSyncCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import {
  buildRoleAttributes,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
  type RoleMutationActor,
} from './roles-handlers.shared.js';

type MutableRole = ManagedRoleRow & {
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
  readonly role_key: string;
  readonly description: string | null;
};

const resolveMutableRole = async (
  actor: RoleMutationActor,
  roleId: string
): Promise<MutableRole | Response> => {
  const existing = await withInstanceScopedDb(actor.instanceId, (client) =>
    loadRoleById(client, { instanceId: actor.instanceId, roleId })
  );

  if (!existing) {
    return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
  }
  if (existing.is_system_role) {
    return createApiError(409, 'conflict', 'System-Rollen können nicht geändert werden.', actor.requestId);
  }
  if (existing.managed_by !== 'studio') {
    return createApiError(
      409,
      'conflict',
      'Extern verwaltete Rollen können im Studio nicht geändert werden.',
      actor.requestId
    );
  }

  return existing;
};

const markRoleSyncState = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  operation: 'update' | 'retry';
  result: 'success' | 'failure';
  roleKey: string;
  externalRoleName: string;
  errorCode?: string;
  syncState: 'pending' | 'failed' | 'synced';
  syncedAt?: boolean;
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await setRoleSyncState(client, {
      instanceId: input.actor.instanceId,
      roleId: input.roleId,
      syncState: input.syncState,
      errorCode: input.errorCode ?? null,
      ...(input.syncedAt ? { syncedAt: true } : {}),
    });
    await emitRoleAuditEvent(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      roleId: input.roleId,
      eventType: input.result === 'failure' ? 'role.sync_failed' : 'role.sync_started',
      operation: input.operation,
      result: input.result,
      roleKey: input.roleKey,
      externalRoleName: input.externalRoleName,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
  });
};

const persistUpdatedRole = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  existing: MutableRole;
  displayName: string;
  description?: string;
  roleLevel: number;
  externalRoleName: string;
  permissionIds?: readonly string[];
  operation: 'update' | 'retry';
}) => {
  return withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await client.query(
      `
UPDATE iam.roles
SET
  display_name = $3,
  description = $4,
  role_level = $5,
  sync_state = 'synced',
  last_synced_at = NOW(),
  last_error_code = NULL,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.actor.instanceId, input.roleId, input.displayName, input.description ?? null, input.roleLevel]
    );

    if (input.permissionIds) {
      await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
        input.actor.instanceId,
        input.roleId,
      ]);
      if (input.permissionIds.length > 0) {
        await client.query(
          `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
          [input.actor.instanceId, input.roleId, input.permissionIds]
        );
      }
    }

    await emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'role.updated',
      result: 'success',
      payload: {
        role_id: input.roleId,
        role_key: input.existing.role_key,
        display_name: input.displayName,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await emitRoleAuditEvent(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      roleId: input.roleId,
      eventType: 'role.sync_succeeded',
      operation: input.operation,
      result: 'success',
      roleKey: input.existing.role_key,
      externalRoleName: input.externalRoleName,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await notifyPermissionInvalidation(client, {
      instanceId: input.actor.instanceId,
      trigger: 'role_updated',
    });

    const updatedRole = await loadRoleListItemById(client, {
      instanceId: input.actor.instanceId,
      roleId: input.roleId,
    });
    if (!updatedRole) {
      throw new Error('role_load_failed');
    }
    return updatedRole;
  });
};

export const updateRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolvedActor = await resolveRoleMutationActor(request, ctx);
  if ('response' in resolvedActor) {
    return resolvedActor.response;
  }

  const { actor } = resolvedActor;
  const roleId = requireRoleId(request, actor.requestId);
  if (roleId instanceof Response) {
    return roleId;
  }

  const parsed = await parseRequestBody(request, updateRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
  }

  const identityProvider = await requireRoleIdentityProvider(actor.instanceId, actor.requestId);
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  try {
    const existing = await resolveMutableRole(actor, roleId);
    if (existing instanceof Response) {
      return existing;
    }

    const operation = parsed.data.retrySync ? 'retry' : 'update';
    const nextDisplayName = parsed.data.displayName?.trim() || getRoleDisplayName(existing);
    const nextDescription = parsed.data.description ?? existing.description ?? undefined;
    const nextRoleLevel = parsed.data.roleLevel ?? existing.role_level;
    const externalRoleName = getRoleExternalName(existing);

    await markRoleSyncState({
      actor,
      roleId,
      operation,
      result: 'success',
      roleKey: existing.role_key,
      externalRoleName,
      syncState: 'pending',
    });

    try {
      await trackKeycloakCall('update_role', () =>
        identityProvider.provider.updateRole(externalRoleName, {
          description: nextDescription,
          attributes: buildRoleAttributes({
            instanceId: actor.instanceId,
            roleKey: existing.role_key,
            displayName: nextDisplayName,
          }),
        })
      );
    } catch (error) {
      const errorCode = mapRoleSyncErrorCode(error);
      iamRoleSyncCounter.add(1, { operation, result: 'failure', error_code: errorCode });
      await markRoleSyncState({
        actor,
        roleId,
        operation,
        result: 'failure',
        roleKey: existing.role_key,
        externalRoleName,
        errorCode,
        syncState: 'failed',
      });
      return buildRoleSyncFailure({
        error,
        requestId: actor.requestId,
        fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
        roleId,
      });
    }

    try {
      const roleItem = await persistUpdatedRole({
        actor,
        roleId,
        existing,
        displayName: nextDisplayName,
        description: nextDescription,
        roleLevel: nextRoleLevel,
        externalRoleName,
        permissionIds: parsed.data.permissionIds,
        operation,
      });
      iamRoleSyncCounter.add(1, { operation, result: 'success', error_code: 'none' });
      return jsonResponse(200, asApiItem(roleItem, actor.requestId));
    } catch (error) {
      try {
        await trackKeycloakCall('update_role_compensation', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: existing.description ?? undefined,
            attributes: buildRoleAttributes({
              instanceId: actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            }),
          })
        );
      } catch {
        await markRoleSyncState({
          actor,
          roleId,
          operation: 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'COMPENSATION_FAILED',
          syncState: 'failed',
        });
        iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent aktualisiert werden.',
          actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await markRoleSyncState({
        actor,
        roleId,
        operation: 'update',
        result: 'failure',
        roleKey: existing.role_key,
        externalRoleName,
        errorCode: 'DB_WRITE_FAILED',
        syncState: 'failed',
      });
      iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      logger.error('Role update database write failed after successful Keycloak update', {
        operation: 'update_role',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        role_id: roleId,
        role_key: existing.role_key,
        error: sanitizeRoleErrorMessage(error),
      });
      return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actor.requestId, {
        syncState: 'failed',
        syncError: { code: 'DB_WRITE_FAILED' },
      });
    }
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actor.requestId);
  }
};
