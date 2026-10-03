import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';
import { wasteManagementOperationSchemas } from '../http-operation-schemas.js';
import { startToolJob } from './operations-job-support.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

const {
  startSeedSchema,
  startMainserverSyncSchema,
  startSyncWasteTypesSchema,
  startEnrichPostalCodesSchema,
  startResetSchema,
} = wasteManagementOperationSchemas;

export const wasteManagementMaintenanceHandlers = {
  startWasteManagementSeedInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.seed.execute',
      endpoint: 'POST:/api/v1/waste-management/tools/seed',
      schema: startSeedSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
      auditActionId: 'waste-management.seed.started',
      toPayload: () => ({
        operation: 'seed-data',
        seedKey: 'baseline',
      }),
    }),
  startWasteManagementMainserverSyncInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.scheduling.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/mainserver-sync',
      schema: startMainserverSyncSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
      auditActionId: 'waste-management.mainserver-sync.started',
      toPayload: () => ({
        operation: 'sync-mainserver',
        keycloakSubject: ctx.user.id,
        activeOrganizationId: ctx.activeOrganizationId,
      }),
    }),
  startWasteManagementSyncWasteTypesInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.master-data.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
      schema: startSyncWasteTypesSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      auditActionId: 'waste-management.sync-waste-types.started',
      toPayload: () => ({
        operation: 'sync-waste-types',
        keycloakSubject: ctx.user.id,
        activeOrganizationId: ctx.activeOrganizationId,
      }),
    }),
  startWasteManagementEnrichPostalCodesInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.master-data.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/postal-codes/enrich',
      schema: startEnrichPostalCodesSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.enrichPostalCodes,
      auditActionId: 'waste-management.postal-code-enrichment.started',
      rejectWhenActiveJobExists: true,
      toPayload: () => ({ operation: 'enrich-postal-codes' }),
    }),
  startWasteManagementResetInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.reset.execute',
      endpoint: 'POST:/api/v1/waste-management/tools/reset',
      schema: startResetSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
      auditActionId: 'waste-management.reset.started',
      toPayload: (data) => ({
        operation: 'reset-data',
        confirmationToken: String(data.confirmationToken),
      }),
    }),
};
