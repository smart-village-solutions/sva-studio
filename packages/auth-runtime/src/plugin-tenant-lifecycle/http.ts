import { normalizeHost, type ApiErrorCode } from '@sva/core';
import { pluginTenantLifecycleOperations } from '@sva/plugin-sdk';
import type { PluginTenantLifecycleOperation } from '@sva/plugin-sdk';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import {
  REGISTRY_ACTIONS,
  type RegistryActionId,
  type RegistryRequestContext,
} from '../iam-instance-registry/auth-context.js';
import { ensurePlatformAccess } from '../iam-instance-registry/http.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
import { isAuthenticatedRegistryServiceRequest } from '../iam-instance-registry/service-token.js';
import { jsonResponse } from '../db.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { translatePluginTenantLifecycleMessage } from './messages.js';
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

const lifecycleServiceActions = {
  provision: REGISTRY_ACTIONS.pluginLifecycleProvision,
  readiness: REGISTRY_ACTIONS.pluginLifecycleReadiness,
  reconcile: REGISTRY_ACTIONS.pluginLifecycleReconcile,
  suspend: REGISTRY_ACTIONS.pluginLifecycleSuspend,
  reactivate: REGISTRY_ACTIONS.pluginLifecycleReactivate,
} as const satisfies Readonly<Record<PluginTenantLifecycleOperation, RegistryActionId>>;

const createInvalidRequestResponse = (request: Request): Response =>
  createApiError(
    400,
    'invalid_request',
    translatePluginTenantLifecycleMessage(request, 'invalidRequest'),
    readRequestId()
  );

export const resolvePluginTenantLifecycleServiceAction = async (
  request: Request
): Promise<RegistryActionId | Response> => {
  const parsed = await parseRequestBody(request.clone(), startLifecycleSchema);
  return parsed.ok
    ? lifecycleServiceActions[parsed.data.operation]
    : createInvalidRequestResponse(request);
};

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

const tenantAccessDenied = (request: Request): Response =>
  createApiError(
    403,
    'forbidden',
    translatePluginTenantLifecycleMessage(request, 'tenantAccessDenied'),
    readRequestId()
  );

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
    case 'plugin_tenant_lifecycle_claim_failed':
      return { code, status: 503 };
    case 'plugin_tenant_lifecycle_inactive':
    case 'plugin_tenant_lifecycle_handler_missing':
    case 'plugin_tenant_lifecycle_cancellation_mismatch':
    case 'plugin_tenant_lifecycle_claim_conflict':
    case 'plugin_tenant_lifecycle_invalid_transition':
    case 'plugin_tenant_lifecycle_request_conflict':
      return { code, status: 409 };
    default:
      return { code: 'plugin_tenant_lifecycle_start_failed', status: 500 };
  }
};

const readContext = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<{ readonly instanceId: string; readonly tenantSession: boolean } | Response> => {
  const tenantSession = ctx.authKind === 'session' && !!ctx.user.instanceId;
  if (!tenantSession) {
    const accessError = ensurePlatformAccess(request, ctx);
    if (accessError) return accessError;
  }
  const instanceId = readInstanceId(request);
  if (!instanceId) {
    return createApiError(
      400,
      'invalid_instance_id',
      translatePluginTenantLifecycleMessage(request, 'invalidInstanceId'),
      readRequestId()
    );
  }
  if (tenantSession && ctx.user.instanceId !== instanceId) return tenantAccessDenied(request);
  const instance = await withRegistryRepository((repository) =>
    repository.getInstanceById(instanceId)
  );
  if (!instance) {
    return createApiError(
      404,
      'not_found',
      translatePluginTenantLifecycleMessage(request, 'instanceNotFound'),
      readRequestId()
    );
  }
  if (tenantSession) {
    if (normalizeHost(resolveEffectiveRequestHost(request)) !== instance.primaryHostname)
      return tenantAccessDenied(request);
    const authorization = await authorizeInstancePermissionForUser({
      ctx,
      action: 'integration.manage',
      instanceId,
    });
    if (!authorization.ok)
      return createApiError(
        authorization.status,
        toInstancePermissionApiErrorCode(authorization.error),
        authorization.message,
        readRequestId()
      );
  }
  return { instanceId, tenantSession };
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
  return jsonResponse(
    200,
    asApiItem(
      context.tenantSession
        ? readiness.filter((item) => item.pluginId === 'app-translations')
        : readiness,
      readRequestId()
    )
  );
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
    return createInvalidRequestResponse(request);
  }
  if (
    context.tenantSession &&
    (parsed.data.pluginId !== 'app-translations' || parsed.data.operation !== 'reconcile')
  )
    return tenantAccessDenied(request);

  try {
    const result = await startConfiguredPluginTenantLifecycle({
      instanceId: context.instanceId,
      pluginId: parsed.data.pluginId,
      operation: parsed.data.operation,
      actorAccountId: ctx.user.id,
      ...(context.tenantSession ? { usePersonalMainserverCredentials: true } : {}),
      requestId: readRequestId(),
      scheduledAt: new Date().toISOString(),
    });
    return jsonResponse(202, asApiItem(result, readRequestId()));
  } catch (error) {
    const lifecycleError = readLifecycleError(error);
    return createApiError(
      lifecycleError.status,
      lifecycleError.code,
      translatePluginTenantLifecycleMessage(request, 'lifecycleStartFailed'),
      readRequestId()
    );
  }
};
