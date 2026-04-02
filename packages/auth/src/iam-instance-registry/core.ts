import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { buildLogContext } from '../shared/log-context.js';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import {
  buildPrimaryHostname,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
  type InstanceStatus,
} from '@sva/core';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import {
  createInstanceSchema,
  ensurePlatformAccess,
  listQuerySchema,
  readDetailInstanceId,
  requireFreshReauth,
  statusMutationSchema,
} from './http.js';
import { withRegistryService } from './repository.js';
import type { ResolveRuntimeInstanceResult } from './types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

export const listInstancesInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });

  if (!parsed.success) {
    return createApiError(400, 'invalid_request', 'Ungültige Filter für die Instanzverwaltung.', getWorkspaceContext().requestId);
  }

  const enriched = await withRegistryService((service) => service.listInstances(parsed.data));

  return jsonResponse(200, asApiList(enriched, { page: 1, pageSize: enriched.length || 1, total: enriched.length }, getWorkspaceContext().requestId));
};

export const getInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const instance = await withRegistryService((service) => service.getInstanceDetail(instanceId));
  if (!instance) {
    return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
  }

  return jsonResponse(
    200,
    asApiItem(instance, getWorkspaceContext().requestId)
  );
};

export const createInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const payloadResult = await parseRequestBody(request, createInstanceSchema);
  if (!payloadResult.ok) {
    return createApiError(400, 'invalid_request', payloadResult.message, getWorkspaceContext().requestId);
  }

  const result = await withRegistryService((service) =>
    service.createProvisioningRequest({
      idempotencyKey: idempotencyResult.key,
      instanceId: payloadResult.data.instanceId,
      displayName: payloadResult.data.displayName,
      parentDomain: payloadResult.data.parentDomain,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
      themeKey: payloadResult.data.themeKey,
      featureFlags: payloadResult.data.featureFlags,
      mainserverConfigRef: payloadResult.data.mainserverConfigRef,
    })
  );

  if (!result.ok) {
    return createApiError(409, 'conflict', 'Instanz-ID ist bereits vergeben.', getWorkspaceContext().requestId);
  }

  logger.info('Instance provisioning requested', {
    operation: 'instance_create',
    instance_id: result.instance.instanceId,
    primary_hostname: buildPrimaryHostname(result.instance.instanceId, normalizeHost(payloadResult.data.parentDomain)),
    actor_id: ctx.user.id,
    ...buildLogContext('platform', { includeTraceId: true }),
  });

  return jsonResponse(201, asApiItem(result.instance, getWorkspaceContext().requestId));
};

const mutateInstanceStatus = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const payloadResult = await parseRequestBody(request, statusMutationSchema);
  if (!payloadResult.ok || payloadResult.data.status !== nextStatus) {
    return createApiError(400, 'invalid_request', 'Ungültiger Statuswechsel.', getWorkspaceContext().requestId);
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const result = await withRegistryService((service) =>
    service.changeStatus({
      idempotencyKey: idempotencyResult.key,
      instanceId,
      nextStatus,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
    })
  );

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return createApiError(409, 'conflict', 'Statuswechsel ist im aktuellen Zustand nicht erlaubt.', getWorkspaceContext().requestId);
  }

  return jsonResponse(200, asApiItem(result.instance, getWorkspaceContext().requestId));
};

export const activateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'active');

export const suspendInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'suspended');

export const archiveInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'archived');

export const resolveRuntimeInstanceFromRequest = async (request: Request): Promise<ResolveRuntimeInstanceResult> => {
  const host = new URL(request.url).host;
  const resolved = await withRegistryService((service) => service.resolveRuntimeInstance(host));
  return {
    hostClassification: resolved.hostClassification,
    instance: resolved.instance,
  };
};

export const createTenantForbiddenResponse = (): Response =>
  createApiError(403, 'forbidden', 'Host not permitted for this operation', getWorkspaceContext().requestId);

export const isInstanceTrafficAllowed = (status: InstanceStatus): boolean =>
  isTrafficEnabledInstanceStatus(status);
