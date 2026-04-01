import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError } from './api-helpers.js';
import {
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleById } from './role-query.js';
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

type MutableRoleForDelete = NonNullable<Awaited<ReturnType<typeof loadRoleById>>>;

const resolveDeletableRole = async (
  actor: RoleMutationActor,
  roleId: string
): Promise<MutableRoleForDelete | Response> => {
  const existing = await withInstanceScopedDb(actor.instanceId, (client) =>
    loadRoleById(client, { instanceId: actor.instanceId, roleId })
  );

  if (!existing) {
    return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
  }
  if (existing.is_system_role) {
    return createApiError(409, 'conflict', 'System-Rollen können nicht gelöscht werden.', actor.requestId);
  }
  if (existing.managed_by !== 'studio') {
    return createApiError(
      409,
      'conflict',
      'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
      actor.requestId
    );
  }

  const dependency = await withInstanceScopedDb(actor.instanceId, async (client) => {
    const result = await client.query<{ used: number }>(
      `
SELECT COUNT(*)::int AS used
FROM iam.account_roles
WHERE instance_id = $1
  AND role_id = $2::uuid;
`,
      [actor.instanceId, roleId]
    );
    return result.rows[0]?.used ?? 0;
  });
  if (dependency > 0) {
    return createApiError(409, 'conflict', 'Rolle wird noch von Nutzern verwendet.', actor.requestId);
  }

  return existing;
};

const markDeleteRoleSyncState = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  roleKey: string;
  externalRoleName: string;
  result: 'success' | 'failure';
  eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
  errorCode?: string;
  syncState?: 'pending' | 'failed';
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    if (input.syncState) {
      await setRoleSyncState(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
        syncState: input.syncState,
        errorCode: input.errorCode ?? null,
      });
    }
    await emitRoleAuditEvent(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      roleId: input.roleId,
      eventType: input.eventType,
      operation: 'delete',
      result: input.result,
      roleKey: input.roleKey,
      externalRoleName: input.externalRoleName,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
  });
};

const deleteRoleFromDatabase = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  roleKey: string;
  externalRoleName: string;
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
      input.actor.instanceId,
      input.roleId,
    ]);
    await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
      input.actor.instanceId,
      input.roleId,
    ]);

    await emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'role.deleted',
      result: 'success',
      payload: {
        role_id: input.roleId,
        role_key: input.roleKey,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await emitRoleAuditEvent(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      roleId: input.roleId,
      eventType: 'role.sync_succeeded',
      operation: 'delete',
      result: 'success',
      roleKey: input.roleKey,
      externalRoleName: input.externalRoleName,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await notifyPermissionInvalidation(client, {
      instanceId: input.actor.instanceId,
      trigger: 'role_deleted',
    });
  });
};

export const deleteRoleInternal = async (
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

  const identityProvider = requireRoleIdentityProvider(actor.requestId);
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  try {
    const existing = await resolveDeletableRole(actor, roleId);
    if (existing instanceof Response) {
      return existing;
    }

    const externalRoleName = getRoleExternalName(existing);
    await markDeleteRoleSyncState({
      actor,
      roleId,
      roleKey: existing.role_key,
      externalRoleName,
      result: 'success',
      eventType: 'role.sync_started',
      syncState: 'pending',
    });

    try {
      await trackKeycloakCall('delete_role', () => identityProvider.provider.deleteRole(externalRoleName));
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError && error.statusCode === 404)) {
        const errorCode = mapRoleSyncErrorCode(error);
        await markDeleteRoleSyncState({
          actor,
          roleId,
          roleKey: existing.role_key,
          externalRoleName,
          result: 'failure',
          eventType: 'role.sync_failed',
          errorCode,
          syncState: 'failed',
        });
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: errorCode });
        return createApiError(503, 'keycloak_unavailable', 'Rolle konnte nicht gelöscht werden.', actor.requestId, {
          syncState: 'failed',
          syncError: { code: errorCode },
        });
      }
    }

    try {
      await deleteRoleFromDatabase({
        actor,
        roleId,
        roleKey: existing.role_key,
        externalRoleName,
      });
    } catch {
      try {
        await trackKeycloakCall('create_role_compensation', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: existing.description ?? undefined,
            attributes: buildRoleAttributes({
              instanceId: actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            }),
          })
        );
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        logger.error('Role delete compensation failed', {
          operation: 'delete_role_compensation',
          instance_id: actor.instanceId,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: sanitizeRoleErrorMessage(compensationError),
        });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent gelöscht werden.',
          actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await markDeleteRoleSyncState({
        actor,
        roleId,
        roleKey: existing.role_key,
        externalRoleName,
        result: 'failure',
        eventType: 'role.sync_failed',
        errorCode: 'DB_WRITE_FAILED',
        syncState: 'failed',
      });
      iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actor.requestId, {
        syncState: 'failed',
        syncError: { code: 'DB_WRITE_FAILED' },
      });
    }

    iamRoleSyncCounter.add(1, { operation: 'delete', result: 'success', error_code: 'none' });
    return jsonResponse(
      200,
      asApiItem(
        {
          id: roleId,
          roleKey: existing.role_key,
          roleName: getRoleDisplayName(existing),
          externalRoleName,
          syncState: 'synced' as const,
        },
        actor.requestId
      )
    );
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actor.requestId);
  }
};
