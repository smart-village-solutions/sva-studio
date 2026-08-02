import { wasteManagementOperationsContract } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { resolveActorInfo } from '../../iam-account-management/shared.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, requireIdempotencyKey } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementSettingsSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import {
  runWasteManagementHolidaySyncAfterValidation,
  updateWasteManagementSettingsAfterValidation,
} from './settings-write-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId } from './utils.js';
import { startPluginOperationJobFromFacade } from './operations-support.js';

const { updateWasteSettingsSchema } = wasteManagementSettingsSchemas;

export const wasteManagementSettingsHandlers = {
  retryWasteTenantProvisioningInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.settings.manage',
      deps,
      requestId
    );
    if (authError) return authError;

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) return instanceId;
    const csrfError = validateCsrf(request, requestId);
    if (csrfError) return csrfError;
    const idempotency = requireIdempotencyKey(request, requestId);
    if ('error' in idempotency) return idempotency.error;
    if (!deps.loadWasteTenantProvisioning || !deps.requestWasteTenantProvisioning) {
      throw new Error('missing_dependency:waste_tenant_provisioning_retry');
    }

    const current = await deps.loadWasteTenantProvisioning(instanceId);
    if (current?.status !== 'failed') {
      return createApiError(
        409,
        'conflict',
        'Die Waste-Bereitstellung kann nur nach einem Fehler erneut gestartet werden.',
        requestId
      );
    }
    const actorResolution = await (deps.resolveActorInfo ??
      ((scopedRequest: Request, scopedCtx: AuthenticatedRequestContext) =>
        resolveActorInfo(scopedRequest, scopedCtx, { requireActorMembership: true })))(request, ctx);
    if ('error' in actorResolution) return actorResolution.error;
    if (!actorResolution.actor.actorAccountId) {
      return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', requestId);
    }

    const requested = await deps.requestWasteTenantProvisioning(instanceId);
    const response = await (deps.startPluginOperationJob ?? startPluginOperationJobFromFacade)({
      instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: '/api/v1/waste-management/settings/provisioning/retry',
      idempotencyKey: idempotency.key,
      requestId,
      scheduledAt: new Date().toISOString(),
      data: {
        pluginId: wasteManagementOperationsContract.pluginId,
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
        input: {
          operation: 'provision-tenant-database',
          desiredGeneration: requested.desiredGeneration,
        },
      },
    });
    if (!response.ok && deps.failWasteTenantProvisioningRequest) {
      await deps.failWasteTenantProvisioningRequest({
        instanceId,
        desiredGeneration: requested.desiredGeneration,
        errorCode: 'job_start_failed',
        errorMessage: 'Der Provisionierungsjob konnte nicht gestartet werden.',
      });
    }
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.provisioning.retry',
      result: response.ok ? 'success' : 'failure',
      reasonCode: response.ok ? undefined : 'job_start_failed',
      resourceType: 'waste_tenant_provisioning',
      resourceId: instanceId,
    });
    return response;
  },
  updateWasteManagementSettingsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.settings.manage', deps, requestId);
    if (authError) return authError;

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) return instanceId;

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) return csrfError;

    const parsed = await parseRequestBody(request, updateWasteSettingsSchema);
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);

    try {
      return await updateWasteManagementSettingsAfterValidation({ deps, ctx, instanceId, requestId, input: parsed.data });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht gespeichert werden.', requestId);
    }
  },
  runWasteManagementHolidaySyncInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.settings.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    try {
      return await runWasteManagementHolidaySyncAfterValidation({ deps, ctx, instanceId, requestId });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      return createApiError(
        503,
        'database_unavailable',
        'Der Waste-Feiertagssync konnte nicht ausgeführt werden.',
        requestId
      );
    }
  },
};
