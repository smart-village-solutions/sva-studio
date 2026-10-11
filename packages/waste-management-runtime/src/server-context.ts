import {
  createSdkLogger,
  toJsonErrorResponse,
  toSafeLogPath,
  withRequestContext,
} from '@sva/server-runtime';
import {
  createWasteProvisioningAccess,
  resolveWasteDataSource,
  runWasteConnectionCheck,
} from './repositories.js';
import { Pool } from 'pg';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import { createPermissionDenialDetailsForAction } from '@sva/core';
import type { listExternalInterfaceRecords, loadDefaultExternalInterfaceRecord } from '@sva/data-repositories/server';

import type {
  AuthenticatedRequestContext,
  WasteAuditEvent,
  WasteManagementHandlerDeps,
} from './handlers/types.js';

type RequiredDependency<K extends keyof WasteManagementHandlerDeps> = NonNullable<
  WasteManagementHandlerDeps[K]
>;

export type WasteServerContextHost = Readonly<{
  buildLogContext: (
    instanceId?: string,
    options?: { includeTraceId?: boolean }
  ) => Record<string, string | undefined>;
  createApiError: (
    status: number,
    code: 'database_unavailable' | 'forbidden',
    message: string,
    requestId?: string,
    details?: Record<string, unknown>
  ) => Response;
  authorizePluginAction: (input: {
    request?: Request;
    handlerId?: string;
    instanceId: string;
    keycloakSubject: string;
    action: string;
    resourceType: string;
    requestId?: string;
  }) => Promise<{ ok: true; allowed: boolean; reason: string } | { ok: false }>;
  isAuthorizedPluginRequest: (input: {
    request: Request;
    handlerId: string;
    pluginId: string;
    instanceId: string;
    keycloakSubject: string;
  }) => boolean;
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
  listExternalInterfaceRecords: typeof listExternalInterfaceRecords;
  loadDefaultExternalInterfaceRecord: typeof loadDefaultExternalInterfaceRecord;
  withInstanceDb: Parameters<typeof createWasteProvisioningAccess>[0];
  saveExternalInterfaceRecord: RequiredDependency<'saveExternalInterfaceRecord'>;
  saveExternalInterfaceConnectionCheck: RequiredDependency<'saveExternalInterfaceConnectionCheck'>;
}>;

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const createAuthenticatedWasteHandler =
  (host: WasteServerContextHost) =>
  (
    ctx: AuthenticatedRequestContext,
    request: Request,
    handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
  ): Promise<Response> =>
    withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
      try {
        const instanceId = ctx.user.instanceId;
        if (
          !instanceId ||
          !ctx.handlerId ||
          !host.isAuthorizedPluginRequest({
            request,
            handlerId: ctx.handlerId,
            pluginId: wasteManagementOperationsContract.pluginId,
            instanceId,
            keycloakSubject: ctx.user.id,
          })
        )
          return host.createApiError(
            403,
            'forbidden',
            'Keine Berechtigung für diese Waste-Management-Operation.',
            host.buildLogContext(instanceId).request_id
          );
        return handler(request, ctx);
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
    request?: Request;
    handlerId?: string;
    instanceId: string;
    keycloakSubject: string;
    action: string;
    requestId?: string;
  }): Promise<Response | null> => {
    let resolved: Awaited<ReturnType<typeof host.authorizePluginAction>>;
    try {
      resolved = await host.authorizePluginAction({ ...input, resourceType: 'waste-management' });
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
    if (resolved.allowed) return null;
    return host.createApiError(
      403,
      'forbidden',
      'Keine Berechtigung für diese Waste-Management-Operation.',
      input.requestId,
      {
        ...createPermissionDenialDetailsForAction(input.action, resolved.reason),
        action: input.action,
        reason_code: resolved.reason,
      }
    );
  };

const createWasteConnectionCheck =
  (host: WasteServerContextHost, provisioning: ReturnType<typeof createWasteProvisioningAccess>) => async (instanceId: string, interfaceId: string) => {
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
      loadProvisioning: provisioning.loadWasteTenantProvisioningRecord,
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

export const createWasteServerContext = (host: WasteServerContextHost) => {
  const provisioning = createWasteProvisioningAccess(host.withInstanceDb);
  return {
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
    loadWasteTenantProvisioning: provisioning.loadWasteTenantProvisioningRecord,
    requestWasteTenantProvisioning: provisioning.requestWasteTenantProvisioning,
    failWasteTenantProvisioningRequest: provisioning.failWasteTenantProvisioningRequest,
    saveExternalInterfaceRecord: host.saveExternalInterfaceRecord,
    saveExternalInterfaceConnectionCheck: host.saveExternalInterfaceConnectionCheck,
    checkWasteConnection: createWasteConnectionCheck(host, provisioning),
  },
  };
};
