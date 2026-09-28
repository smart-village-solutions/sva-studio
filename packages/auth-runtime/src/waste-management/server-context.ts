import {
  createSdkLogger,
  toJsonErrorResponse,
  toSafeLogPath,
  withRequestContext,
} from '@sva/server-runtime';
import { resolveWasteDataSource, runWasteConnectionCheck } from '@sva/waste-management-runtime/repositories';
import { Pool } from 'pg';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceConnectionCheck,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { createPermissionDenialDetailsForAction } from '@sva/core';

import { emitAuthAuditEvent } from '../audit-events.js';
import { revealField } from '../iam-account-management/encryption.js';
import { resolveActorInfo as resolveIamActorInfo } from '../iam-account-management/shared.js';
import {
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
} from '../iam-account-management/shared.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { storePluginOperationInput } from '../plugin-operation-artifacts.server.js';
import { buildLogContext } from '../log-context.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import { translatePluginTenantLifecycleMessage } from '../plugin-tenant-lifecycle/messages.js';
import { createApiError } from '../shared/request-helpers.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';
import { validateCsrf } from '../shared/request-security.js';

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const withWasteManagementRequestContext = <T>(
  request: Request,
  work: () => Promise<T>
): Promise<T> => withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const withAuthenticatedWasteManagementHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withWasteManagementRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, async (ctx) => {
        const instanceId = ctx.user.instanceId;
        if (instanceId) {
          const access = await readConfiguredPluginTenantAccess(
            instanceId,
            wasteManagementOperationsContract.pluginId
          );
          if (!access.allowed) {
            return createApiError(
              409,
              'plugin_tenant_access_blocked',
              translatePluginTenantLifecycleMessage(request, 'pluginAccessBlocked'),
              buildLogContext(instanceId).request_id,
              { reason_code: access.reason }
            );
          }
        }
        return handler(request, ctx);
      });
    } catch (error) {
      const logContext = buildLogContext('default', { includeTraceId: true });
      logger.error('Waste management request failed unexpectedly', {
        operation: 'waste_management_request',
        endpoint: toSafeLogPath(request.url),
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        reason_code: 'instance_scope_unhandled_failure',
        ...logContext,
      });
      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Waste-Management-Fehler.', {
        requestId: logContext.request_id,
      });
    }
  });

export const sharedWasteManagementDeps = {
  authorizeAction: async (input: {
    instanceId: string;
    keycloakSubject: string;
    action: string;
    requestId?: string;
  }): Promise<Response | null> => {
    let resolved: Awaited<ReturnType<typeof resolveEffectivePermissions>>;
    try {
      resolved = await resolveEffectivePermissions({
        instanceId: input.instanceId,
        keycloakSubject: input.keycloakSubject,
      });
    } catch {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', input.requestId);
    }
    if (!resolved.ok) {
      return createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', input.requestId);
    }
    const decision = evaluateAuthorizeDecision({
      instanceId: input.instanceId,
      action: input.action,
      resource: { type: 'waste-management' },
      context: input.requestId ? { requestId: input.requestId } : {},
    }, resolved.permissions);
    if (decision.allowed) return null;
    return createApiError(
      403,
      'forbidden',
      'Keine Berechtigung für diese Waste-Management-Operation.',
      input.requestId,
      {
        ...createPermissionDenialDetailsForAction(input.action, decision.reason),
        action: input.action,
        reason_code: decision.reason,
      }
    );
  },
  validateCsrf,
  reserveIdempotency,
  renewIdempotencyLease,
  releaseIdempotencyReservation,
  hasIdempotentAuditEvent,
  completeIdempotency,
  startPluginOperationJob: startPluginOperationJobFromFacade,
  storeWasteImportSource: storePluginOperationInput,
  resolveActorInfo: (
    request: Request,
    context: AuthenticatedRequestContext
  ) => resolveIamActorInfo(request, context, { requireActorMembership: true }),
  emitAuditEvent: emitAuthAuditEvent,
  loadDefaultInterfaceRecord: loadDefaultExternalInterfaceRecord,
  listInterfaceRecords: listExternalInterfaceRecords,
  loadWasteTenantProvisioning: loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
  checkWasteConnection: async (instanceId: string, interfaceId: string) => {
    const interfaceRecord =
      (await listExternalInterfaceRecords(instanceId)).find((record) => record.id === interfaceId) ??
      (await loadDefaultExternalInterfaceRecord(instanceId, 'postgresql'));
    if (!interfaceRecord || interfaceRecord.id !== interfaceId || interfaceRecord.instanceId !== instanceId) {
      throw new Error('waste_interface_not_found');
    }
    const dataSource = await resolveWasteDataSource({
      instanceId,
      loadDefaultInterface: async () => interfaceRecord,
      loadProvisioning: loadWasteTenantProvisioningRecord,
      revealSecret: revealField,
    });
    return runWasteConnectionCheck({
      dataSource,
      probe: async (source) => {
        const pool = new Pool({
          connectionString: source.databaseUrl,
          max: 1,
          idleTimeoutMillis: 5_000,
          connectionTimeoutMillis: 5_000,
        });
        try {
          const client = await pool.connect();
          try {
            await client.query('SELECT 1;');
          } finally {
            client.release();
          }
        } finally {
          await pool.end();
        }
      },
      now: () => new Date(),
    });
  },
} as const;
