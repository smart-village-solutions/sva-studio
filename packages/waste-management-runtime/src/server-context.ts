import {
  createSdkLogger,
  toJsonErrorResponse,
  toSafeLogPath,
  withRequestContext,
} from '@sva/server-runtime';
import { resolveWasteDataSource, runWasteConnectionCheck } from './repositories.js';
import { Pool } from 'pg';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { createPermissionDenialDetailsForAction } from '@sva/core';

import type { EffectivePermission } from '@sva/iam-core';
import type {
  AuthenticatedRequestContext,
  WasteAuditEvent,
  WasteManagementHandlerDeps,
} from './handlers/types.js';

type RequiredDependency<K extends keyof WasteManagementHandlerDeps> = NonNullable<
  WasteManagementHandlerDeps[K]
>;

export type WasteServerContextHost = Readonly<{
  withAuthenticatedUser: (
    request: Request,
    handler: (ctx: AuthenticatedRequestContext) => Promise<Response> | Response
  ) => Promise<Response>;
  readConfiguredPluginTenantAccess: (
    instanceId: string,
    pluginId: string
  ) => Promise<{ allowed: true } | { allowed: false; reason: string }>;
  translatePluginTenantLifecycleMessage: (request: Request, key: 'pluginAccessBlocked') => string;
  buildLogContext: (
    instanceId?: string,
    options?: { includeTraceId?: boolean }
  ) => Record<string, string | undefined>;
  createApiError: (
    status: number,
    code: 'plugin_tenant_access_blocked' | 'database_unavailable' | 'forbidden',
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) => Response;
  resolveEffectivePermissions: (input: {
    instanceId: string;
    keycloakSubject: string;
  }) => Promise<{ ok: true; permissions: readonly EffectivePermission[] } | { ok: false }>;
  resolveIamActorInfo: (
    request: Request,
    ctx: AuthenticatedRequestContext,
    options: { requireActorMembership: true }
  ) => ReturnType<RequiredDependency<'resolveActorInfo'>>;
  emitAuthAuditEvent: (
    event: WasteAuditEvent & {
      actorUserId?: string;
      actorEmail?: string;
      actorDisplayName?: string;
    }
  ) => Promise<void>;
  revealField: (ciphertext: string | null | undefined, aad: string) => string | undefined;
  startPluginOperationJobFromFacade: RequiredDependency<'startPluginOperationJob'>;
  storePluginOperationInput: RequiredDependency<'storeWasteImportSource'>;
  validateCsrf: RequiredDependency<'validateCsrf'>;
  reserveIdempotency: RequiredDependency<'reserveIdempotency'>;
  renewIdempotencyLease: RequiredDependency<'renewIdempotencyLease'>;
  releaseIdempotencyReservation: RequiredDependency<'releaseIdempotencyReservation'>;
  hasIdempotentAuditEvent: RequiredDependency<'hasIdempotentAuditEvent'>;
  completeIdempotency: RequiredDependency<'completeIdempotency'>;
  listExternalInterfaceRecords: typeof import('@sva/data-repositories/server').listExternalInterfaceRecords;
  loadDefaultExternalInterfaceRecord: typeof import('@sva/data-repositories/server').loadDefaultExternalInterfaceRecord;
  loadWasteTenantProvisioningRecord: typeof import('@sva/data-repositories/server').loadWasteTenantProvisioningRecord;
  requestWasteTenantProvisioning: RequiredDependency<'requestWasteTenantProvisioning'>;
  failWasteTenantProvisioningRequest: RequiredDependency<'failWasteTenantProvisioningRequest'>;
  saveExternalInterfaceRecord: RequiredDependency<'saveExternalInterfaceRecord'>;
  saveExternalInterfaceConnectionCheck: RequiredDependency<'saveExternalInterfaceConnectionCheck'>;
}>;

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const createAuthenticatedWasteHandler =
  (host: WasteServerContextHost) =>
  (
    request: Request,
    handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
  ): Promise<Response> =>
    withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
      try {
        return await host.withAuthenticatedUser(request, async (ctx) => {
          const instanceId = ctx.user.instanceId;
          if (instanceId) {
            const access = await host.readConfiguredPluginTenantAccess(
              instanceId,
              wasteManagementOperationsContract.pluginId
            );
            if (!access.allowed) {
              return host.createApiError(
                409,
                'plugin_tenant_access_blocked',
                host.translatePluginTenantLifecycleMessage(request, 'pluginAccessBlocked'),
                host.buildLogContext(instanceId).request_id,
                { reason_code: access.reason }
              );
            }
          }
          return handler(request, ctx);
        });
      } catch (error) {
        const logContext = host.buildLogContext('default', { includeTraceId: true });
        logger.error('Waste management request failed unexpectedly', {
          operation: 'waste_management_request',
          endpoint: toSafeLogPath(request.url),
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          reason_code: 'instance_scope_unhandled_failure',
          ...logContext,
        });
        return toJsonErrorResponse(
          500,
          'internal_error',
          'Unbehandelter Waste-Management-Fehler.',
          {
            requestId: logContext.request_id,
          }
        );
      }
    });

const createWasteActionAuthorizer =
  (host: WasteServerContextHost) =>
  async (input: {
    instanceId: string;
    keycloakSubject: string;
    action: string;
    requestId?: string;
  }): Promise<Response | null> => {
    let resolved: Awaited<ReturnType<typeof host.resolveEffectivePermissions>>;
    try {
      resolved = await host.resolveEffectivePermissions({
        instanceId: input.instanceId,
        keycloakSubject: input.keycloakSubject,
      });
    } catch {
      return host.createApiError(
        503,
        'database_unavailable',
        'Berechtigungen konnten nicht geprüft werden.',
        input.requestId
      );
    }
    if (!resolved.ok) {
      return host.createApiError(
        503,
        'database_unavailable',
        'Berechtigungen konnten nicht geprüft werden.',
        input.requestId
      );
    }
    const decision = evaluateAuthorizeDecision(
      {
        instanceId: input.instanceId,
        action: input.action,
        resource: { type: 'waste-management' },
        context: input.requestId ? { requestId: input.requestId } : {},
      },
      resolved.permissions
    );
    if (decision.allowed) return null;
    return host.createApiError(
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
  };

const createWasteConnectionCheck =
  (host: WasteServerContextHost) => async (instanceId: string, interfaceId: string) => {
    const interfaceRecord =
      (await host.listExternalInterfaceRecords(instanceId)).find(
        (record) => record.id === interfaceId
      ) ?? (await host.loadDefaultExternalInterfaceRecord(instanceId, 'postgresql'));
    if (
      !interfaceRecord ||
      interfaceRecord.id !== interfaceId ||
      interfaceRecord.instanceId !== instanceId
    ) {
      throw new Error('waste_interface_not_found');
    }
    const dataSource = await resolveWasteDataSource({
      instanceId,
      loadDefaultInterface: async () => interfaceRecord,
      loadProvisioning: host.loadWasteTenantProvisioningRecord,
      revealSecret: host.revealField,
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
  };

export const createWasteServerContext = (host: WasteServerContextHost) => ({
  withAuthenticatedWasteManagementHandler: createAuthenticatedWasteHandler(host),
  sharedWasteManagementDeps: {
    authorizeAction: createWasteActionAuthorizer(host),
    validateCsrf: host.validateCsrf,
    reserveIdempotency: host.reserveIdempotency,
    renewIdempotencyLease: host.renewIdempotencyLease,
    releaseIdempotencyReservation: host.releaseIdempotencyReservation,
    hasIdempotentAuditEvent: host.hasIdempotentAuditEvent,
    completeIdempotency: host.completeIdempotency,
    startPluginOperationJob: host.startPluginOperationJobFromFacade,
    storeWasteImportSource: host.storePluginOperationInput,
    resolveActorInfo: (request: Request, context: AuthenticatedRequestContext) =>
      host.resolveIamActorInfo(request, context, { requireActorMembership: true }),
    emitAuditEvent: host.emitAuthAuditEvent,
    loadDefaultInterfaceRecord: host.loadDefaultExternalInterfaceRecord,
    listInterfaceRecords: host.listExternalInterfaceRecords,
    loadWasteTenantProvisioning: host.loadWasteTenantProvisioningRecord,
    requestWasteTenantProvisioning: host.requestWasteTenantProvisioning,
    failWasteTenantProvisioningRequest: host.failWasteTenantProvisioningRequest,
    saveExternalInterfaceRecord: host.saveExternalInterfaceRecord,
    saveExternalInterfaceConnectionCheck: host.saveExternalInterfaceConnectionCheck,
    checkWasteConnection: createWasteConnectionCheck(host),
  },
});
