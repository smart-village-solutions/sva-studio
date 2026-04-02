import { classifyHost, isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data/server';
import { createSdkLogger, getInstanceConfig, parseInstanceIdFromHost } from '@sva/sdk/server';

import { buildLogContext } from './shared/log-context.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const forbiddenTenantHost = () =>
  new Response(JSON.stringify({ error: 'forbidden', message: 'Host not permitted for this operation' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

export const resolveSessionUser = async (request: Request, user: SessionUser): Promise<SessionUser> => {
  if (user.instanceId) {
    return user;
  }

  const host = new URL(request.url).host;
  const registryEntry = await loadInstanceByHostname(host).catch(() => null);
  const derivedInstanceId = registryEntry?.instanceId ?? parseInstanceIdFromHost(host);
  if (!derivedInstanceId) {
    return user;
  }

  logger.warn('Auth middleware derived missing session instance from request host', {
    endpoint: request.url,
    operation: 'auth_middleware',
    auth_state: 'authenticated',
    user_id: user.id,
    derived_instance_id: derivedInstanceId,
    ...buildLogContext(derivedInstanceId, { includeTraceId: true }),
  });

  return {
    ...user,
    instanceId: derivedInstanceId,
  };
};

export const validateTenantHost = async (request: Request): Promise<Response | null> => {
  const host = new URL(request.url).host;
  const config = getInstanceConfig();
  if (!config) {
    return null;
  }

  const classification = classifyHost(host, config.parentDomain);
  if (classification.kind !== 'tenant') {
    return null;
  }

  const registryEntry = await loadInstanceByHostname(host).catch(() => null);
  if (!registryEntry || !isTrafficEnabledInstanceStatus(registryEntry.status)) {
    logger.warn('Auth middleware rejected request for invalid or inactive tenant host', {
      endpoint: request.url,
      operation: 'auth_middleware',
      tenant_host: host,
      registry_found: Boolean(registryEntry),
      registry_status: registryEntry?.status ?? null,
      ...buildLogContext(undefined, { includeTraceId: true }),
    });
    return forbiddenTenantHost();
  }

  return null;
};
