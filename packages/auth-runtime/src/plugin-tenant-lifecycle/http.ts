import type { ApiErrorCode } from '@sva/core';
import { pluginTenantLifecycleOperations } from '@sva/plugin-sdk';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import type { RegistryRequestContext } from '../iam-instance-registry/auth-context.js';
import { ensurePlatformAccess } from '../iam-instance-registry/http.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import { isAuthenticatedRegistryServiceRequest } from '../iam-instance-registry/service-token.js';
import { jsonResponse } from '../db.js';
import { readConfiguredPluginTenantReadiness } from './read-model.js';
import { startConfiguredPluginTenantLifecycle } from './runtime.js';

const startLifecycleSchema = z.object({
  pluginId: z
    .string()
    .trim()
    .min(2)
    .max(31)
    .regex(/^[a-z][a-z0-9-]+$/),
  operation: z.enum(pluginTenantLifecycleOperations),
});

const readInstanceId = (request: Request): string | null => {
  const match = new URL(request.url).pathname.match(/^\/api\/v1\/iam\/instances\/([^/]+)\//);
  if (!match?.[1]) {
    return null;
  }
  try {
    const instanceId = decodeURIComponent(match[1]).trim();
    return instanceId.length > 0 ? instanceId : null;
  } catch {
    return null;
  }
};

const readRequestId = (): string | undefined => getWorkspaceContext().requestId;

const requireInstance = async (instanceId: string): Promise<Response | null> => {
  const instance = await withRegistryRepository((repository) =>
    repository.getInstanceById(instanceId)
  );
  return instance
    ? null
    : createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', readRequestId());
};

const readLifecycleError = (
  error: unknown
): { readonly code: ApiErrorCode; readonly status: number } => {
  const code = error instanceof Error ? error.message.split(':')[0] : '';
  switch (code) {
    case 'plugin_tenant_lifecycle_not_declared':
      return { code, status: 404 };
    case 'plugin_tenant_lifecycle_operation_not_declared':
      return { code, status: 400 };
    case 'plugin_tenant_lifecycle_enqueue_failed':
    case 'plugin_tenant_lifecycle_job_creation_failed':
      return { code, status: 503 };
    case 'plugin_tenant_lifecycle_inactive':
    case 'plugin_tenant_lifecycle_handler_missing':
    case 'plugin_tenant_lifecycle_cancellation_mismatch':
    case 'plugin_tenant_lifecycle_claim_conflict':
      return { code, status: 409 };
    default:
      return { code: 'plugin_tenant_lifecycle_start_failed', status: 500 };
  }
};

const readContext = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<{ readonly instanceId: string } | Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }
  const instanceId = readInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', readRequestId());
  }
  const instanceError = await requireInstance(instanceId);
  return instanceError ?? { instanceId };
};

export const getPluginTenantReadinessInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const context = await readContext(request, ctx);
  if (context instanceof Response) {
    return context;
  }
  const readiness = await readConfiguredPluginTenantReadiness(context.instanceId);
  return jsonResponse(200, asApiItem(readiness, readRequestId()));
};

export const startPluginTenantLifecycleInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => {
  const context = await readContext(request, ctx);
  if (context instanceof Response) {
    return context;
  }
  const csrfError = isAuthenticatedRegistryServiceRequest(request)
    ? null
    : validateSessionCsrf(request, readRequestId());
  if (csrfError) {
    return csrfError;
  }
  const parsed = await parseRequestBody(request, startLifecycleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, readRequestId());
  }

  try {
    const result = await startConfiguredPluginTenantLifecycle({
      instanceId: context.instanceId,
      pluginId: parsed.data.pluginId,
      operation: parsed.data.operation,
      actorAccountId: ctx.user.id,
      requestId: readRequestId(),
      scheduledAt: new Date().toISOString(),
    });
    return jsonResponse(202, asApiItem(result, readRequestId()));
  } catch (error) {
    const lifecycleError = readLifecycleError(error);
    return createApiError(
      lifecycleError.status,
      lifecycleError.code,
      'Plugin-Lifecycle konnte nicht gestartet werden.',
      readRequestId()
    );
  }
};
