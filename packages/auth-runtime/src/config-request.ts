import { classifyHost, isTrafficEnabledInstanceStatus, normalizeHost } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data-repositories/server';
import { createSdkLogger, getInstanceConfig, isCanonicalAuthHost } from '@sva/server-runtime';

import { resolveEffectiveRequestHost } from './request-hosts.js';
import type { ResolvedTenantClientSecret } from './config-tenant-secret.js';
import { TenantAuthResolutionError } from './runtime-errors.js';
import type { AuthConfig, RuntimeScopeRef } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth-config', level: 'info' });

type RegistryEntry = Awaited<ReturnType<typeof loadInstanceByHostname>>;

export type PersonalApiAuthBinding = {
  readonly issuer: string;
  readonly audience: string;
  readonly scope: RuntimeScopeRef;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const resolvePersonalApiAuthBinding = async (
  request: Request
): Promise<PersonalApiAuthBinding> => {
  const host = resolveEffectiveRequestHost(request);
  const instanceConfig = getInstanceConfig();
  if (!instanceConfig || isCanonicalAuthHost(host)) {
    return {
      issuer: requireEnv('SVA_AUTH_ISSUER'),
      audience: requireEnv('SVA_AUTH_CLIENT_ID'),
      scope: { kind: 'platform' },
    };
  }

  const classification = classifyHost(
    host,
    instanceConfig.parentDomain,
    instanceConfig.canonicalAuthHost
  );
  if (classification.kind === 'root') {
    return {
      issuer: requireEnv('SVA_AUTH_ISSUER'),
      audience: requireEnv('SVA_AUTH_CLIENT_ID'),
      scope: { kind: 'platform' },
    };
  }
  if (classification.kind !== 'tenant') {
    throw new TenantAuthResolutionError({ host, reason: 'tenant_host_invalid' });
  }

  const registryEntry = await loadRegistryEntryForHost(host);
  if (!registryEntry) {
    throw new TenantAuthResolutionError({ host, reason: 'tenant_not_found' });
  }
  assertActiveRegistryEntry(host, registryEntry);
  const keycloakBaseUrl = process.env.KEYCLOAK_ADMIN_BASE_URL;
  const issuer = registryEntry.authIssuerUrl ??
    (keycloakBaseUrl
      ? `${keycloakBaseUrl.replace(/\/+$/u, '')}/realms/${registryEntry.authRealm}`
      : requireEnv('SVA_AUTH_ISSUER'));
  return {
    issuer,
    audience: registryEntry.authClientId,
    scope: { kind: 'instance', instanceId: registryEntry.instanceId },
  };
};

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
  registryEntry: NonNullable<RegistryEntry>,
  options: { readonly allowKasselProvisioningLoginProbe?: boolean } = {}
): void => {
  const isNarrowProvisioningProbe =
    options.allowKasselProvisioningLoginProbe === true &&
    process.env.SVA_TENANT_INGRESS_MODE === 'kassel-traefik-file' &&
    normalizeHost(registryEntry.parentDomain) === 'dialog.kassel.de' &&
    registryEntry.status === 'provisioning';
  if (!isTrafficEnabledInstanceStatus(registryEntry.status) && !isNarrowProvisioningProbe) {
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
