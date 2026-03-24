import { getWorkspaceContext } from '@sva/sdk/server';

import type { IdentityProviderPort } from '../identity-provider-port.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { readString } from '../shared/input-readers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  emitRoleAuditEvent,
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProvider,
  setRoleDriftBacklog,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { validateCsrf } from './csrf.js';
import {
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import type { ManagedRoleRow } from './types.js';

type ReconcileRoleEntry = {
  readonly roleId?: string;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
};

type ReconcileReport = {
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly ReconcileRoleEntry[];
};

const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? readString(values[0]) : undefined;
};

const isStudioManagedIdentityRole = (
  role: Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T ? Exclude<T, null> : never,
  instanceId: string
): boolean =>
  readRoleAttribute(role.attributes, 'managed_by') === 'studio' &&
  readRoleAttribute(role.attributes, 'instance_id') === instanceId;

const readImportableRoleMetadata = (
  role: Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T ? Exclude<T, null> : never
): { roleKey: string; displayName: string; roleLevel: number } | null => {
  const roleKey = readRoleAttribute(role.attributes, 'role_key');
  const displayName = readRoleAttribute(role.attributes, 'display_name');
  const roleLevelRaw = readRoleAttribute(role.attributes, 'role_level');
  const parsedRoleLevel = roleLevelRaw ? Number(roleLevelRaw) : 0;

  if (!roleKey || !displayName) {
    return null;
  }

  if (!Number.isFinite(parsedRoleLevel) || parsedRoleLevel < 0 || parsedRoleLevel > 100) {
    return null;
  }

  return {
    roleKey,
    displayName,
    roleLevel: parsedRoleLevel,
  };
};

const BUILTIN_REALM_ROLE_NAMES = new Set(['offline_access', 'uma_authorization']);

const isPotentialStudioManagedRealmRole = (
  role: Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T ? Exclude<T, null> : never
): boolean => {
  if (role.clientRole) {
    return false;
  }

  if (BUILTIN_REALM_ROLE_NAMES.has(role.externalName)) {
    return false;
  }

  if (role.externalName.startsWith('default-roles-')) {
    return false;
  }

  return true;
};

export const runRoleCatalogReconciliation = async (input: {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
}): Promise<ReconcileReport> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('identity_provider_unavailable');
  }

  const dbRoles = await withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ManagedRoleRow>(
      `
SELECT
  id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at::text,
  last_error_code
FROM iam.roles
WHERE instance_id = $1
  AND managed_by = 'studio'
ORDER BY role_level DESC, COALESCE(display_name, role_name) ASC;
`,
      [input.instanceId]
    );
    return result.rows;
  });

  const idpRoles = await trackKeycloakCall('reconcile_list_roles', () => identityProvider.provider.listRoles());
  const managedIdpRoles = idpRoles.filter((role) => isStudioManagedIdentityRole(role, input.instanceId));
  const idpByExternalName = new Map(managedIdpRoles.map((role) => [role.externalName, role]));
  const dbByExternalName = new Map(dbRoles.map((role) => [getRoleExternalName(role), role]));

  const entries: ReconcileRoleEntry[] = [];

  for (const role of dbRoles) {
    const externalRoleName = getRoleExternalName(role);
    const matchingIdentityRole = idpByExternalName.get(externalRoleName);
    const expectedDisplayName = getRoleDisplayName(role);
    const identityDisplayName = readRoleAttribute(matchingIdentityRole?.attributes, 'display_name');

    if (!matchingIdentityRole) {
      try {
        await trackKeycloakCall('reconcile_create_role', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: role.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: input.instanceId,
              roleKey: role.role_key,
              displayName: expectedDisplayName,
            },
          })
        );
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    const descriptionChanged = (matchingIdentityRole.description ?? undefined) !== (role.description ?? undefined);
    const displayNameChanged = identityDisplayName !== expectedDisplayName;
    const roleKeyChanged = readRoleAttribute(matchingIdentityRole.attributes, 'role_key') !== role.role_key;

    if (descriptionChanged || displayNameChanged || roleKeyChanged || role.sync_state !== 'synced') {
      try {
        await trackKeycloakCall('reconcile_update_role', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: role.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: input.instanceId,
              roleKey: role.role_key,
              displayName: expectedDisplayName,
            },
          })
        );
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'update',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'update',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    entries.push({
      roleId: role.id,
      roleKey: role.role_key,
      externalRoleName,
      action: 'noop',
      status: 'synced',
    });
  }

  for (const identityRole of managedIdpRoles) {
    if (!dbByExternalName.has(identityRole.externalName)) {
      const importableMetadata = readImportableRoleMetadata(identityRole);
      if (importableMetadata) {
        try {
          const importedRole = await withInstanceScopedDb(input.instanceId, async (client) => {
            const inserted = await client.query<{ id: string }>(
              `
INSERT INTO iam.roles (
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at,
  last_error_code
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, false, $7, 'studio', 'synced', NOW(), NULL)
RETURNING id;
`,
              [
                input.instanceId,
                importableMetadata.roleKey,
                importableMetadata.roleKey,
                importableMetadata.displayName,
                identityRole.externalName,
                identityRole.description ?? null,
                importableMetadata.roleLevel,
              ]
            );
            const roleId = inserted.rows[0]?.id;
            if (!roleId) {
              throw new Error('role_import_failed');
            }

            await emitRoleAuditEvent(client, {
              instanceId: input.instanceId,
              accountId: input.actorAccountId,
              roleId,
              eventType: 'role.reconciled',
              operation: 'reconcile_import',
              result: 'success',
              roleKey: importableMetadata.roleKey,
              externalRoleName: identityRole.externalName,
              requestId: input.requestId,
              traceId: input.traceId,
            });

            return { roleId };
          });
          entries.push({
            roleId: importedRole.roleId,
            roleKey: importableMetadata.roleKey,
            externalRoleName: identityRole.externalName,
            action: 'create',
            status: 'corrected',
          });
          continue;
        } catch (error) {
          entries.push({
            roleKey: importableMetadata.roleKey,
            externalRoleName: identityRole.externalName,
            action: 'create',
            status: 'failed',
            errorCode: mapRoleSyncErrorCode(error),
          });
          continue;
        }
      }

      entries.push({
        externalRoleName: identityRole.externalName,
        roleKey: readRoleAttribute(identityRole.attributes, 'role_key'),
        action: 'report',
        status: 'requires_manual_action',
        errorCode: 'REQUIRES_MANUAL_ACTION',
      });
    }
  }

  for (const identityRole of idpRoles) {
    if (idpByExternalName.has(identityRole.externalName) || dbByExternalName.has(identityRole.externalName)) {
      continue;
    }

    if (!isPotentialStudioManagedRealmRole(identityRole)) {
      continue;
    }

    entries.push({
      externalRoleName: identityRole.externalName,
      roleKey: readRoleAttribute(identityRole.attributes, 'role_key') ?? identityRole.externalName,
      action: 'report',
      status: 'requires_manual_action',
      errorCode: 'REQUIRES_MANUAL_ACTION',
    });
  }

  const report = {
    checkedCount: entries.length,
    correctedCount: entries.filter((entry) => entry.status === 'corrected').length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
    requiresManualActionCount: entries.filter((entry) => entry.status === 'requires_manual_action').length,
    roles: entries,
  } satisfies ReconcileReport;

  setRoleDriftBacklog(input.instanceId, report.failedCount + report.requiresManualActionCount);
  return report;
};

export const reconcilePlaceholderInternal = async (
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

  try {
    const report = await runRoleCatalogReconciliation({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    });
    return jsonResponse(200, asApiItem(report, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('Role reconciliation failed', {
      operation: 'reconcile_roles',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: sanitizeRoleErrorMessage(error),
    });
    return createApiError(
      503,
      'keycloak_unavailable',
      'Rollen-Reconciliation konnte nicht ausgeführt werden.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: mapRoleSyncErrorCode(error) },
      }
    );
  }
};

let roleCatalogSchedulerStarted = false;
const roleCatalogSchedulerInFlight = new Set<string>();

export const readScheduledReconcileInstanceIds = (): readonly string[] =>
  (process.env.IAM_ROLE_RECONCILE_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const ensureRoleCatalogSchedulerStarted = (): void => {
  if (roleCatalogSchedulerStarted) {
    return;
  }

  const intervalRaw = process.env.IAM_ROLE_RECONCILE_INTERVAL_MS;
  const intervalMs = intervalRaw ? Number(intervalRaw) : Number.NaN;
  const instanceIds = readScheduledReconcileInstanceIds();
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || instanceIds.length === 0) {
    return;
  }

  roleCatalogSchedulerStarted = true;
  const timer = setInterval(async () => {
    for (const instanceId of instanceIds) {
      if (roleCatalogSchedulerInFlight.has(instanceId)) {
        logger.warn('Role catalog reconciliation already running; skipping overlapping scheduler run', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'skipped',
          error_code: 'SCHEDULER_ALREADY_RUNNING',
          request_id: `scheduler:${Date.now()}:${instanceId}`,
        });
        continue;
      }

      roleCatalogSchedulerInFlight.add(instanceId);
      const schedulerRequestId = `scheduler:${Date.now()}:${instanceId}`;
      try {
        const report = await runRoleCatalogReconciliation({
          instanceId,
          requestId: schedulerRequestId,
        });
        logger.info('Role catalog reconciliation completed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'success',
          request_id: schedulerRequestId,
          checked_count: report.checkedCount,
          corrected_count: report.correctedCount,
          failed_count: report.failedCount,
          requires_manual_action_count: report.requiresManualActionCount,
        });
      } catch (error) {
        logger.error('Role catalog reconciliation scheduler failed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'failure',
          request_id: schedulerRequestId,
          error: sanitizeRoleErrorMessage(error),
        });
      } finally {
        roleCatalogSchedulerInFlight.delete(instanceId);
      }
    }
  }, intervalMs);

  timer.unref?.();
};

ensureRoleCatalogSchedulerStarted();
