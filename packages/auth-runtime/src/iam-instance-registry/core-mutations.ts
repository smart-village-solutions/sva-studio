import { asApiItem, createApiError, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { InstanceStatus } from '@sva/core';
import { wasteManagementOperationsContract } from '@sva/core';
import { loadWasteTenantProvisioningRecord } from '@sva/data-repositories/server';
import {
  createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers,
} from '@sva/instance-registry/http-mutation-handlers';
import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { confirmCriticalRegistryMutation } from './confirmation.js';
import {
  ensurePlatformAccess,
  requireFreshReauth,
} from './http.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { withRegistryService, withScopedRegistryService } from './repository.js';
import { startPluginOperationJobFromFacade } from '../waste-management/core/operations-support.js';
import { createSdkLogger } from '@sva/server-runtime';

const logger = createSdkLogger({ component: 'instance-module-provisioning', level: 'info' });

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const readInstanceMutationResult = async (
  response: Response
): Promise<{ readonly instanceId?: string; readonly assignedModules?: readonly string[] }> => {
  const body = (await response.clone().json().catch(() => null)) as
    | {
        data?: { instanceId?: unknown; id?: unknown; assignedModules?: unknown };
        item?: { instanceId?: unknown; id?: unknown; assignedModules?: unknown };
        instanceId?: unknown;
        id?: unknown;
        assignedModules?: unknown;
      }
    | null;
  const record = body?.data ?? body?.item ?? body;
  if (!record) {
    return {};
  }
  const instanceId =
    typeof record.instanceId === 'string'
      ? record.instanceId
      : typeof record.id === 'string'
        ? record.id
        : undefined;
  const assignedModules = Array.isArray(record.assignedModules)
    ? record.assignedModules.filter((value): value is string => typeof value === 'string')
    : undefined;
  return { ...(instanceId ? { instanceId } : {}), ...(assignedModules ? { assignedModules } : {}) };
};

const enqueueWasteTenantProvisioning = async (
  response: Response,
  ctx: RegistryRequestContext,
  operation: 'assignment' | 'bootstrap'
): Promise<void> => {
  try {
    const { instanceId } = await readInstanceMutationResult(response);
    if (!instanceId) {
      throw new Error('waste_provisioning_instance_id_missing');
    }
    const provisioning = await loadWasteTenantProvisioningRecord(instanceId);
    if (!provisioning || provisioning.status === 'ready') {
      return;
    }
    const enqueueResponse = await startPluginOperationJobFromFacade({
      instanceId,
      actorAccountId: ctx.user.id,
      endpoint: '/api/iam/instances/:instanceId/modules/waste-management/provision',
      idempotencyKey: `waste-provisioning:${instanceId}:${provisioning.desiredGeneration}`,
      requestId: getRequestId(),
      scheduledAt: new Date().toISOString(),
      data: {
        pluginId: wasteManagementOperationsContract.pluginId,
        jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
        input: {
          operation: 'provision-tenant-database',
          desiredGeneration: provisioning.desiredGeneration,
        },
      },
    });
    if (!enqueueResponse.ok) {
      logger.error('Waste tenant database provisioning could not be enqueued', {
        operation: 'enqueue_waste_tenant_database_provisioning',
        trigger: operation,
        workspace_id: instanceId,
        status_code: enqueueResponse.status,
      });
    }
  } catch (error) {
    logger.error('Waste tenant database provisioning enqueue failed', {
      operation: 'enqueue_waste_tenant_database_provisioning',
      trigger: operation,
      error_type: error instanceof Error ? error.name : typeof error,
    });
  }
};

const mutationHandlers = createInstanceRegistryMutationHttpHandlers<RegistryRequestContext>({
  getRequestId,
  getActor: (ctx) => ({ id: ctx.user.id }),
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  parseRequestBody: parseRegistryRequestBody,
  requireIdempotencyKey,
  ensurePlatformAccess,
  validateCsrf: (request, requestId) =>
    isAuthenticatedRegistryServiceRequest(request) ? null : validateSessionCsrf(request, requestId),
  requireFreshReauth,
  withRegistryService,
  withScopedRegistryService,
  confirmCriticalMutation: confirmCriticalRegistryMutation,
});

export const mapInstanceMutationError = createInstanceMutationErrorMapper({
  getRequestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
});

export const reconcileInstanceKeycloakMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.reconcileInstanceKeycloak(request, ctx);

export const executeInstanceKeycloakProvisioningMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.executeInstanceKeycloakProvisioning(request, ctx);

export const rotateInstanceSecretMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.rotateInstanceSecret(request, ctx);

export const assignInstanceModuleMutation = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const payload = await request.clone().json().catch(() => null) as { moduleId?: unknown } | null;
  const response = await mutationHandlers.assignModule(request, ctx);
  if (response.ok && payload?.moduleId === 'waste-management') {
    await enqueueWasteTenantProvisioning(response, ctx, 'assignment');
  }
  return response;
};

export const bootstrapInstanceAdminStructureMutation = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const response = await mutationHandlers.bootstrapAdminStructure(request, ctx);
  if (response.ok) {
    const result = await readInstanceMutationResult(response);
    if (result.assignedModules?.includes('waste-management')) {
      await enqueueWasteTenantProvisioning(response, ctx, 'bootstrap');
    }
  }
  return response;
};

export const revokeInstanceModuleMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.revokeModule(request, ctx);

export const seedInstanceIamBaselineMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.seedIamBaseline(request, ctx);

export const probeTenantIamAccessMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.probeTenantIamAccess(request, ctx);

export const mutateInstanceStatus = (
  request: Request,
  ctx: RegistryRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => mutationHandlers.mutateInstanceStatus(request, ctx, nextStatus);
