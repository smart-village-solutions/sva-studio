import { asApiItem, asApiList, createApiError, parseRequestBody, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { buildLogContext } from '../shared/log-context.js';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { buildPrimaryHostname, normalizeHost } from '@sva/core';
import {
  buildCreateInstanceProvisioningInput,
  buildUpdateInstanceInput,
} from '@sva/instance-registry/mutation-input-builders';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { createInstanceSchema, ensurePlatformAccess, listQuerySchema, readDetailInstanceId, requireFreshReauth, updateInstanceSchema } from './http.js';
import { mapInstanceMutationError, mutateInstanceStatus } from './core-mutations.js';
import { withRegistryService } from './repository.js';

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
  return jsonResponse(
    200,
    asApiList(enriched, { page: 1, pageSize: enriched.length, total: enriched.length }, getWorkspaceContext().requestId)
  );
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

  return jsonResponse(200, asApiItem(instance, getWorkspaceContext().requestId));
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
    service.createProvisioningRequest(buildCreateInstanceProvisioningInput(payloadResult.data, {
      idempotencyKey: idempotencyResult.key,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
    }))
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

export const updateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
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

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const payloadResult = await parseRequestBody(request, updateInstanceSchema);
  if (!payloadResult.ok) {
    return createApiError(400, 'invalid_request', payloadResult.message, getWorkspaceContext().requestId);
  }

  try {
    const updated = await withRegistryService((service) =>
      service.updateInstance(buildUpdateInstanceInput(instanceId, payloadResult.data, {
        actorId: ctx.user.id,
        requestId: getWorkspaceContext().requestId,
      }))
    );

    if (!updated) {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }

    return jsonResponse(200, asApiItem(updated, getWorkspaceContext().requestId));
  } catch (error) {
    return mapInstanceMutationError(error);
  }
};

export const activateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'active');

export const suspendInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'suspended');

export const archiveInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'archived');
