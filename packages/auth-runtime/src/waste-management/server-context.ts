import {
  createSdkLogger,
  toJsonErrorResponse,
  toSafeLogPath,
  withRequestContext,
} from '@sva/server-runtime';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceConnectionCheck,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import { wasteManagementOperationsContract } from '@sva/core';

import { protectField, revealField } from '../iam-account-management/encryption.js';
import { buildLogContext } from '../log-context.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { readConfiguredPluginTenantAccess } from '../plugin-tenant-lifecycle/access.js';
import { createApiError } from '../shared/request-helpers.js';

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
              'Der Plugin-Fachzugriff ist noch nicht betriebsbereit.',
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
  loadDefaultInterfaceRecord: loadDefaultExternalInterfaceRecord,
  listInterfaceRecords: listExternalInterfaceRecords,
  loadWasteTenantProvisioning: loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
  protectSecret: protectField,
  revealSecret: revealField,
} as const;
