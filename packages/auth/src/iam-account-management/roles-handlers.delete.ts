import { getWorkspaceContext } from '@sva/sdk/server';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid } from '../shared/input-readers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError, readPathSegment } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleById } from './role-query.js';
import { validateCsrf } from './csrf.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { iamRoleSyncCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProvider, withInstanceScopedDb } from './shared-runtime.js';

export const deleteRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: 'IDP_UNAVAILABLE' },
      }
    );
  }

  try {
    const existing = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actorResolution.actor.instanceId, roleId })
    );

    if (!existing) {
      return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actorResolution.actor.requestId);
    }
    if (existing.is_system_role) {
      return createApiError(
        409,
        'conflict',
        'System-Rollen können nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }

    const dependency = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const result = await client.query<{ used: number }>(
        `
SELECT COUNT(*)::int AS used
FROM iam.account_roles
WHERE instance_id = $1
  AND role_id = $2::uuid;
`,
        [actorResolution.actor.instanceId, roleId]
      );
      return result.rows[0]?.used ?? 0;
    });
    if (dependency > 0) {
      return createApiError(
        409,
        'conflict',
        'Rolle wird noch von Nutzern verwendet.',
        actorResolution.actor.requestId
      );
    }

    const externalRoleName = getRoleExternalName(existing);

    await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      await setRoleSyncState(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
        syncState: 'pending',
        errorCode: null,
      });
      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'delete',
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    try {
      await trackKeycloakCall('delete_role', () => identityProvider.provider.deleteRole(externalRoleName));
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError && error.statusCode === 404)) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'delete',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: errorCode });
        return buildRoleSyncFailure({
          error,
          requestId: actorResolution.actor.requestId,
          fallbackMessage: 'Rolle konnte nicht gelöscht werden.',
          roleId,
        });
      }
    }

    try {
      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);
        await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.deleted',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_succeeded',
          operation: 'delete',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_deleted',
        });
      });
    } catch {
      try {
        await trackKeycloakCall('create_role_compensation', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: existing.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            },
          })
        );
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        logger.error('Role delete compensation failed', {
          operation: 'delete_role_compensation',
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: sanitizeRoleErrorMessage(compensationError),
        });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent gelöscht werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'failed',
          errorCode: 'DB_WRITE_FAILED',
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_failed',
          operation: 'delete',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      return createApiError(
        500,
        'internal_error',
        'Rolle konnte nicht gelöscht werden.',
        actorResolution.actor.requestId,
        {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        }
      );
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
        actorResolution.actor.requestId
      )
    );
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actorResolution.actor.requestId);
  }
};
