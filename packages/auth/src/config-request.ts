import type { AuthConfig } from './types.js';
import type { ResolvedTenantClientSecret } from './config-tenant-secret.js';
import { createSdkLogger, getInstanceConfig } from '@sva/server-runtime';
import { isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data-repositories/server';
import { TenantAuthResolutionError, type TenantAuthResolutionFailureReason } from './runtime-errors.js';

const logger = createSdkLogger({ component: 'iam-auth-config', level: 'info' });

type RegistryEntry = Awaited<ReturnType<typeof loadInstanceByHostname>>;

const formatResolutionError = (error: unknown): string | undefined => {
  if (error === undefined || error === null) {
    return undefined;
  }

  return error instanceof Error ? error.message : String(error);
};

export const logGlobalAuthResolution = (request: Request, host: string, requestOrigin: string): void => {
  const instanceConfig = getInstanceConfig();
  logger.warn('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    scope_kind: 'platform',
    auth_scope_kind: 'platform',
    host,
    request_origin: requestOrigin,
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

export const logTenantAuthResolutionFailure = (
  request: Request,
  input: {
    host: string;
    requestOrigin: string;
    reason: TenantAuthResolutionFailureReason;
    error?: unknown;
  }
): void => {
  const instanceConfig = getInstanceConfig();
  logger.error('tenant_auth_resolution_failed', {
    operation: 'tenant_auth_resolution',
    host: input.host,
    request_origin: input.requestOrigin,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    reason: input.reason,
    error: formatResolutionError(input.error),
  });
};

export const logInstanceConfigMissing = (host: string, requestOrigin: string): void => {
  logger.info('tenant_auth_resolution_summary', {
    operation: 'tenant_auth_resolution',
    host,
    request_origin: requestOrigin,
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

export const loadRegistryEntryForHost = async (host: string, requestOrigin: string): Promise<RegistryEntry> =>
  loadInstanceByHostname(host).catch((error) => {
    logger.error('Tenant hostname lookup failed during auth resolution', {
      operation: 'tenant_auth_resolution',
      host,
      request_origin: requestOrigin,
      reason_code: 'tenant_lookup_failed',
      dependency: 'database',
      error_type: error instanceof Error ? error.name : typeof error,
    });
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_lookup_failed',
      cause: error,
    });
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
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_inactive',
      publicMessage: 'Anmeldung ist für diesen Mandanten derzeit nicht verfügbar, weil die Instanz nicht aktiv ist.',
    });
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
    scope_kind: 'instance',
    auth_scope_kind: 'instance',
    host,
    request_origin: requestOrigin,
    forwarded_host_header: request.headers.get('x-forwarded-host') ?? undefined,
    request_host_header: request.headers.get('host') ?? undefined,
    forwarded_header_present: request.headers.get('forwarded') ? 'true' : 'false',
    canonical_auth_host: instanceConfig?.canonicalAuthHost,
    parent_domain: instanceConfig?.parentDomain,
    workspace_id: registryEntry.instanceId,
    instance_id: registryEntry.instanceId,
    auth_realm: registryEntry.authRealm,
    client_id: registryEntry.authClientId,
    issuer: authConfig.issuer,
    redirect_uri: authConfig.redirectUri,
    result: 'tenant',
    resolution_result: 'instance',
    secret_source: tenantSecret.source,
    tenant_secret_configured: tenantSecret.configured,
    tenant_secret_readable: tenantSecret.readable,
    oidc_cache_key_scope: tenantSecret.source === 'tenant' ? 'tenant_secret' : 'global_secret',
    secret_reason: tenantSecret.reason,
  });
};
