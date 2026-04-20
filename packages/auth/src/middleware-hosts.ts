import { classifyHost, isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data/server';
import { createSdkLogger, getInstanceConfig, getWorkspaceContext } from '@sva/sdk/server';

import { buildLogContext } from './shared/log-context.js';
import { resolveEffectiveRequestHost } from './request-hosts.js';
import { createApiError } from './shared/request-helpers.js';
import { SessionUserHydrationError } from './runtime-errors.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const forbiddenTenantHost = (input: {
  code?: 'forbidden' | 'database_unavailable';
  dependency?: 'database';
  instanceId?: string;
  reasonCode: string;
  requestId?: string;
  status?: number;
}) =>
  createApiError(
    input.status ?? 403,
    input.code ?? 'forbidden',
    'Host not permitted for this operation',
    input.requestId,
    {
      reason_code: input.reasonCode,
      ...(input.dependency ? { dependency: input.dependency } : {}),
      ...(input.instanceId ? { instance_id: input.instanceId } : {}),
    }
  );

export const resolveSessionUser = async (request: Request, user: SessionUser): Promise<SessionUser> => {
  if (user.instanceId) {
    return user;
  }

  const host = resolveEffectiveRequestHost(request);
  const normalizedHost = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const hostSegmentCount = normalizedHost.split('.').filter(Boolean).length;
  const config = getInstanceConfig();
  const classification = config
    ? classifyHost(host, config.parentDomain)
    : hostSegmentCount >= 4 && normalizedHost !== 'localhost'
      ? { kind: 'tenant' as const }
      : { kind: 'root' as const };
  if (classification.kind !== 'tenant') {
    return user;
  }

  logger.warn('Auth middleware rejected tenant request because the session user lacks instance context', {
    endpoint: request.url,
    operation: 'auth_middleware',
    auth_state: 'authenticated',
    user_id: user.id,
    tenant_host: host,
    ...buildLogContext(undefined, { includeTraceId: true }),
  });

  throw new SessionUserHydrationError({
    reason: 'missing_instance_id',
    requestHost: host,
  });
};

export const validateTenantHost = async (request: Request): Promise<Response | null> => {
  const host = resolveEffectiveRequestHost(request);
  const config = getInstanceConfig();
  if (!config) {
    return null;
  }

  const classification = classifyHost(host, config.parentDomain);
  if (classification.kind !== 'tenant') {
    return null;
  }

  const requestId = getWorkspaceContext().requestId;
  let registryEntry: Awaited<ReturnType<typeof loadInstanceByHostname>>;
  try {
    registryEntry = await loadInstanceByHostname(host);
  } catch (error) {
    logger.error('Auth middleware failed to load tenant host from registry', {
      endpoint: request.url,
      operation: 'auth_middleware',
      tenant_host: host,
      reason_code: 'tenant_lookup_failed',
      dependency: 'database',
      error_type: error instanceof Error ? error.name : typeof error,
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return forbiddenTenantHost({
      code: 'database_unavailable',
      dependency: 'database',
      reasonCode: 'tenant_lookup_failed',
      requestId,
      status: 503,
    });
  }

  if (!registryEntry || !isTrafficEnabledInstanceStatus(registryEntry.status)) {
    const reasonCode = registryEntry ? 'tenant_inactive' : 'tenant_not_found';
    logger.warn('Auth middleware rejected request for invalid or inactive tenant host', {
      endpoint: request.url,
      operation: 'auth_middleware',
      tenant_host: host,
      registry_found: Boolean(registryEntry),
      registry_status: registryEntry?.status ?? null,
      reason_code: reasonCode,
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return forbiddenTenantHost({
      instanceId: registryEntry?.instanceId,
      reasonCode,
      requestId,
    });
  }

  return null;
};
