import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid } from '../shared/input-readers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleById, loadRoleListItemById } from './role-query.js';
import { updateRoleSchema } from './schemas.js';
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

export const updateRoleInternal = async (
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

  const parsed = await parseRequestBody(request, updateRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
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
        'System-Rollen können nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }

    const nextDisplayName = parsed.data.displayName?.trim() || getRoleDisplayName(existing);
    const nextDescription = parsed.data.description ?? existing.description ?? undefined;
    const nextRoleLevel = parsed.data.roleLevel ?? existing.role_level;
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
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    try {
      await trackKeycloakCall('update_role', () =>
        identityProvider.provider.updateRole(externalRoleName, {
          description: nextDescription,
          attributes: {
            managedBy: 'studio',
            instanceId: actorResolution.actor.instanceId,
            roleKey: existing.role_key,
            displayName: nextDisplayName,
          },
        })
      );
    } catch (error) {
      const errorCode = mapRoleSyncErrorCode(error);
      iamRoleSyncCounter.add(1, {
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'failure',
        error_code: errorCode,
      });
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
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
        roleId,
      });
    }

    try {
      const roleItem = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
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
          [actorResolution.actor.instanceId, roleId, nextDisplayName, nextDescription ?? null, nextRoleLevel]
        );

        if (parsed.data.permissionIds) {
          await client.query(
            'DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;',
            [actorResolution.actor.instanceId, roleId]
          );
          if (parsed.data.permissionIds.length > 0) {
            await client.query(
              `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
              [actorResolution.actor.instanceId, roleId, parsed.data.permissionIds]
            );
          }
        }

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.updated',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
            display_name: nextDisplayName,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_succeeded',
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_updated',
        });

        const updatedRole = await loadRoleListItemById(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
        });
        if (!updatedRole) {
          throw new Error('role_load_failed');
        }
        return updatedRole;
      });

      iamRoleSyncCounter.add(1, {
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'success',
        error_code: 'none',
      });
      return jsonResponse(200, asApiItem(roleItem, actorResolution.actor.requestId));
    } catch (error) {
      try {
        await trackKeycloakCall('update_role_compensation', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: existing.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            },
          })
        );
      } catch {
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode: 'COMPENSATION_FAILED',
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'update',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode: 'COMPENSATION_FAILED',
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent aktualisiert werden.',
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
          operation: 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      logger.error('Role update database write failed after successful Keycloak update', {
        operation: 'update_role',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        role_id: roleId,
        role_key: existing.role_key,
        error: sanitizeRoleErrorMessage(error),
      });
      return createApiError(
        500,
        'internal_error',
        'Rolle konnte nicht aktualisiert werden.',
        actorResolution.actor.requestId,
        {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        }
      );
    }
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actorResolution.actor.requestId);
  }
};
