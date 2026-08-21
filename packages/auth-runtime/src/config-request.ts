import { isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data-repositories/server';
import { createSdkLogger, getInstanceConfig } from '@sva/server-runtime';

import type { ResolvedTenantClientSecret } from './config-tenant-secret.js';
import { TenantAuthResolutionError } from './runtime-errors.js';
import type { AuthConfig } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth-config', level: 'info' });

type RegistryEntry = Awaited<ReturnType<typeof loadInstanceByHostname>>;

export const logGlobalAuthResolution = (request: Request, host: string): void => {
  const instanceConfig = getInstanceConfig();
  logger.debug('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    scope_kind: 'platform',
    auth_scope_kind: 'platform',
    host,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    workspace_id: 'platform',
    auth_realm: 'global',
    result: 'platform',
    resolution_result: 'platform',
    reason: 'tenant_not_found',
    secret_source: 'global',
    tenant_secret_configured: false,
    tenant_secret_readable: false,
    oidc_cache_key_scope: 'global_secret',
  });
};

export const logInstanceConfigMissing = (host: string): void => {
  logger.debug('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    host,
    scope_kind: 'platform',
    auth_scope_kind: 'platform',
    workspace_id: 'platform',
    auth_realm: 'global',
    result: 'platform',
    resolution_result: 'platform',
    reason: 'instance_config_missing',
    secret_source: 'global',
    tenant_secret_configured: false,
    tenant_secret_readable: false,
    oidc_cache_key_scope: 'global_secret',
  });
};

export const loadRegistryEntryForHost = async (host: string): Promise<RegistryEntry> =>
  loadInstanceByHostname(host).catch((error) => {
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_lookup_failed',
      cause: error,
    });
  });

export const assertActiveRegistryEntry = (
  host: string,
  registryEntry: NonNullable<RegistryEntry>
): void => {
  if (!isTrafficEnabledInstanceStatus(registryEntry.status)) {
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_inactive',
      publicMessage:
        'Anmeldung ist für diesen Mandanten derzeit nicht verfügbar, weil die Instanz nicht aktiv ist.',
    });
  }
};

export const logTenantAuthResolution = (
  request: Request,
  host: string,
  authConfig: AuthConfig,
  registryEntry: NonNullable<RegistryEntry>,
  tenantSecret: ResolvedTenantClientSecret
): void => {
  const instanceConfig = getInstanceConfig();
  logger.debug('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    scope_kind: 'instance',
    auth_scope_kind: 'instance',
    host,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    workspace_id: registryEntry.instanceId,
    instance_id: registryEntry.instanceId,
    auth_realm: registryEntry.authRealm,
    client_id: registryEntry.authClientId,
    issuer_path: new URL(authConfig.issuer).pathname,
    redirect_path: new URL(authConfig.redirectUri).pathname,
    result: 'tenant',
    resolution_result: 'instance',
    secret_source: tenantSecret.source,
    tenant_secret_configured: tenantSecret.configured,
    tenant_secret_readable: tenantSecret.readable,
    oidc_cache_key_scope: tenantSecret.source === 'tenant' ? 'tenant_secret' : 'global_secret',
    secret_reason: tenantSecret.reason,
  });
};
