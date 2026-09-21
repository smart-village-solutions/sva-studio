import {
  asApiItem,
  asApiList,
  createApiError,
  requireIdempotencyKey,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { buildLogContext } from '../log-context.js';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { createInstanceRegistryHttpHandlers } from '@sva/instance-registry/http-instance-handlers';

import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import {
  assignInstanceModuleMutation,
  bootstrapInstanceAdminStructureMutation,
  mapInstanceMutationError,
  mutateInstanceStatus,
  revokeInstanceModuleMutation,
  seedInstanceIamBaselineMutation,
} from './core-mutations.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { readInstanceRegistryPluginOidcClientRequirements } from './plugin-activation-policy-snapshot.js';
import {
  withRegistryCreateService,
  withRegistryRepository,
  withRegistryService,
  withScopedRegistryService,
} from './repository.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

const instanceHttpHandlers = createInstanceRegistryHttpHandlers<RegistryRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  getActor: (ctx) => ({ id: ctx.user.id }),
  createApiError: (status, code, message, requestId, details) =>
    createApiError(
      status,
      code as Parameters<typeof createApiError>[1],
      message,
      requestId,
      details
    ),
  jsonResponse,
  asApiItem,
  asApiList,
  parseRequestBody: parseRegistryRequestBody,
  requireIdempotencyKey,
  mapMutationError: mapInstanceMutationError,
  ensurePlatformAccess,
  validateCsrf: (request, requestId) =>
    isAuthenticatedRegistryServiceRequest(request) ? null : validateSessionCsrf(request, requestId),
  requireFreshReauth,
  withRegistryCreateService,
  withRegistryService,
  withScopedRegistryService,
  reservedOidcClientIds: () =>
    readInstanceRegistryPluginOidcClientRequirements().map(({ clientId }) => clientId),
  onInstanceProvisioningRequested: ({ instanceId, primaryHostname, actorId }) => {
    void withScopedRegistryService(instanceId, (service) =>
      service.getInstanceDetail(instanceId)
    ).catch(async (error) => {
      try {
        await withRegistryRepository((repository) =>
          repository.recordProvisioningWakeupFailure({
            instanceId,
            errorCode: 'post_commit_wakeup_failed',
            errorMessage: 'Post-Commit-Wake-up fehlgeschlagen.',
            occurredAt: new Date().toISOString(),
          })
        );
      } catch (persistenceError) {
        logger.error('Instance post-create follow-up failure could not be persisted', {
          operation: 'instance_post_create_follow_up_evidence',
          result: 'failed',
          error_code: 'instance_post_create_follow_up_evidence_failed',
          error_type:
            persistenceError instanceof Error ? persistenceError.name : typeof persistenceError,
          instance_id: instanceId,
          ...buildLogContext('platform', { includeTraceId: true }),
        });
      }
      logger.error('Instance post-create follow-up failed', {
        operation: 'instance_post_create_follow_up',
        result: 'failed',
        error_code: 'instance_post_create_follow_up_failed',
        error_type: error instanceof Error ? error.name : typeof error,
        instance_id: instanceId,
        ...buildLogContext('platform', { includeTraceId: true }),
      });
    });
    logger.info('Instance provisioning requested', {
      operation: 'instance_create',
      instance_id: instanceId,
      primary_hostname: primaryHostname,
      actor_id: actorId,
      ...buildLogContext('platform', { includeTraceId: true }),
    });
  },
});

export const listInstancesInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  return instanceHttpHandlers.listInstances(request, ctx);
};

export const getInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  return instanceHttpHandlers.getInstance(request, ctx);
};

export const createInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  return instanceHttpHandlers.createInstance(request, ctx);
};

export const getInstanceDraftReadinessInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => instanceHttpHandlers.getDraftReadiness(request, ctx);

export const listInstanceRealmsInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => instanceHttpHandlers.listRealmCatalog(request, ctx);

export const retryTenantProvisioningInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => instanceHttpHandlers.retryTenantProvisioning(request, ctx);

export const updateInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  return instanceHttpHandlers.updateInstance(request, ctx);
};

export const activateInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutateInstanceStatus(request, ctx, 'active');

export const suspendInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutateInstanceStatus(request, ctx, 'suspended');

export const archiveInstanceInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutateInstanceStatus(request, ctx, 'archived');

export const assignInstanceModuleInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => assignInstanceModuleMutation(request, ctx);

export const bootstrapInstanceAdminStructureInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => bootstrapInstanceAdminStructureMutation(request, ctx);

export const revokeInstanceModuleInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => revokeInstanceModuleMutation(request, ctx);

export const seedInstanceIamBaselineInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => seedInstanceIamBaselineMutation(request, ctx);
