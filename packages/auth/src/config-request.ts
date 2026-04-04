import type { AuthConfig } from './types.js';
import type { ResolvedTenantClientSecret } from './config-tenant-secret.js';
import { createSdkLogger, getInstanceConfig } from '@sva/sdk/server';
import { isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data/server';

const logger = createSdkLogger({ component: 'iam-auth-config', level: 'info' });

type RegistryEntry = Awaited<ReturnType<typeof loadInstanceByHostname>>;

export const logGlobalAuthResolution = (request: Request, host: string, requestOrigin: string): void => {
  const instanceConfig = getInstanceConfig();
  logger.warn('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    host,
    request_origin: requestOrigin,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    instance_id: 'global',
    auth_realm: 'global',
    result: 'global_fallback',
    reason: 'tenant_not_found',
    secret_source: 'global',
    tenant_secret_configured: false,
    tenant_secret_readable: false,
    oidc_cache_key_scope: 'global_secret',
  });
};

export const logInstanceConfigMissing = (host: string, requestOrigin: string): void => {
  logger.info('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    host,
    request_origin: requestOrigin,
    instance_id: 'global',
    auth_realm: 'global',
    result: 'global',
    reason: 'instance_config_missing',
    secret_source: 'global',
    tenant_secret_configured: false,
    tenant_secret_readable: false,
    oidc_cache_key_scope: 'global_secret',
  });
};

export const loadRegistryEntryForHost = async (host: string, requestOrigin: string): Promise<RegistryEntry> =>
  loadInstanceByHostname(host).catch((error) => {
    logger.warn('Tenant hostname lookup failed during auth resolution; falling back to global auth config', {
      operation: 'tenant_auth_resolution',
      auth_resolution_mode: 'global_fallback',
      host,
      request_origin: requestOrigin,
      reason: 'tenant_lookup_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

export const assertActiveRegistryEntry = (host: string, requestOrigin: string, registryEntry: NonNullable<RegistryEntry>): void => {
  if (!isTrafficEnabledInstanceStatus(registryEntry.status)) {
    logger.warn('Tenant hostname resolved to non-active registry entry', {
      operation: 'tenant_auth_resolution',
      host,
      request_origin: requestOrigin,
      instance_id: registryEntry.instanceId,
      tenant_status: registryEntry.status,
    });
    throw new Error(`Tenant host ${host} is not active`);
  }
};

export const logTenantAuthResolution = (
  request: Request,
  host: string,
  requestOrigin: string,
  authConfig: AuthConfig,
  registryEntry: NonNullable<RegistryEntry>,
  tenantSecret: ResolvedTenantClientSecret
): void => {
  const instanceConfig = getInstanceConfig();
  logger.info('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    host,
    request_origin: requestOrigin,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    instance_id: registryEntry.instanceId,
    auth_realm: registryEntry.authRealm,
    client_id: registryEntry.authClientId,
    issuer: authConfig.issuer,
    redirect_uri: authConfig.redirectUri,
    result: 'tenant',
    secret_source: tenantSecret.source,
    tenant_secret_configured: tenantSecret.configured,
    tenant_secret_readable: tenantSecret.readable,
    oidc_cache_key_scope: tenantSecret.source === 'tenant' ? 'tenant_secret' : 'global_secret',
    secret_reason: tenantSecret.reason,
  });
};
