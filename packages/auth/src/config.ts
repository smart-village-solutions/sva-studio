import type { AuthConfig, SessionAuthContext } from './types.js';
import { classifyHost, isTrafficEnabledInstanceStatus, normalizeHost } from '@sva/core';
import { loadInstanceById } from '@sva/data-repositories/server';
import { getInstanceConfig, isCanonicalAuthHost } from '@sva/server-runtime';
import { getAuthClientSecret, getAuthStateSecret } from './runtime-secrets.server.js';
import { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
import { resolveTenantAuthClientSecret } from './config-tenant-secret.js';
import {
  assertActiveRegistryEntry,
  loadRegistryEntryForHost,
  logGlobalAuthResolution,
  logInstanceConfigMissing,
  logTenantAuthResolutionFailure,
  logTenantAuthResolution,
} from './config-request.js';
import { TenantAuthResolutionError } from './runtime-errors.js';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const readNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveBaseAuthConfig = (overrides: { clientSecret?: string } = {}) => {
  const clientSecret = overrides.clientSecret ?? getAuthClientSecret();
  if (!clientSecret) {
    throw new Error(
      'Missing auth client secret (SVA_AUTH_CLIENT_SECRET or /run/secrets/sva_studio_app_auth_client_secret)'
    );
  }

  return {
    clientSecret,
    loginStateSecret: getAuthStateSecret() ?? clientSecret,
    scopes: process.env.SVA_AUTH_SCOPES ?? 'openid',
    sessionCookieName: process.env.SVA_AUTH_SESSION_COOKIE ?? 'sva_auth_session',
    loginStateCookieName: process.env.SVA_AUTH_LOGIN_STATE_COOKIE ?? 'sva_auth_state',
    silentSsoSuppressCookieName: process.env.SVA_AUTH_SILENT_SSO_SUPPRESS_COOKIE ?? 'sva_auth_silent_sso',
    sessionTtlMs: readNumber('SVA_AUTH_SESSION_TTL_MS', 60 * 60 * 1000),
    sessionRedisTtlBufferMs: readNumber('SVA_AUTH_SESSION_REDIS_TTL_BUFFER_MS', 5 * 60 * 1000),
    silentSsoSuppressAfterLogoutMs: readNumber(
      'SVA_AUTH_SILENT_SSO_SUPPRESS_AFTER_LOGOUT_MS',
      5 * 60 * 1000
    ),
  };
};

const normalizeBaseUrl = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
};

const buildIssuerUrl = (realm: string, explicitIssuerUrl?: string): string => {
  if (explicitIssuerUrl) {
    return explicitIssuerUrl;
  }

  const baseUrl = process.env.KEYCLOAK_ADMIN_BASE_URL;
  if (!baseUrl) {
    return requireEnv('SVA_AUTH_ISSUER');
  }

  return `${normalizeBaseUrl(baseUrl)}/realms/${realm}`;
};

const applyLocalDevPortToOrigin = (origin: string, host: string): string => {
  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.port) {
      return origin;
    }

    const publicBaseUrl = process.env.SVA_PUBLIC_BASE_URL?.trim();
    if (!publicBaseUrl) {
      return origin;
    }

    const publicBase = new URL(publicBaseUrl);
    if (!publicBase.port) {
      return origin;
    }

    const normalizedOriginHost = normalizeHost(parsedOrigin.hostname);
    const normalizedHost = normalizeHost(host);
    const normalizedPublicBaseHost = normalizeHost(publicBase.hostname);
    if (parsedOrigin.protocol !== publicBase.protocol) {
      return origin;
    }

    if (
      normalizedOriginHost !== normalizedHost ||
      !(normalizedHost === normalizedPublicBaseHost || normalizedHost.endsWith(`.${normalizedPublicBaseHost}`))
    ) {
      return origin;
    }

    parsedOrigin.port = publicBase.port;
    return normalizeBaseUrl(parsedOrigin.toString());
  } catch {
    return origin;
  }
};

const buildRequestOrigin = (request: Request): string =>
  applyLocalDevPortToOrigin(buildRequestOriginFromHeaders(request), resolveEffectiveRequestHost(request));
const resolveRequestHost = (request: Request): string => resolveEffectiveRequestHost(request);
const buildHostOrigin = (hostname: string, protocol = 'https'): string => `${protocol}://${normalizeHost(hostname)}`;

type BaseAuthConfig = ReturnType<typeof resolveBaseAuthConfig>;
type PlatformAuthConfig = Extract<AuthConfig, { kind: 'platform' }>;
type InstanceAuthConfig = Extract<AuthConfig, { kind: 'instance' }>;
type PlatformAuthOverrides = Omit<PlatformAuthConfig, keyof BaseAuthConfig>;
type InstanceAuthOverrides = Omit<InstanceAuthConfig, keyof BaseAuthConfig>;

function mergeAuthConfig(base: BaseAuthConfig, overrides: PlatformAuthOverrides): PlatformAuthConfig;
function mergeAuthConfig(base: BaseAuthConfig, overrides: InstanceAuthOverrides): InstanceAuthConfig;
function mergeAuthConfig(
  base: BaseAuthConfig,
  overrides: PlatformAuthOverrides | InstanceAuthOverrides
): AuthConfig {
  if (overrides.kind === 'instance') {
    return {
      ...base,
      ...overrides,
    };
  }

  return {
    ...base,
    ...overrides,
  };
}

export const resolveAuthConfigFromSessionAuth = (auth: SessionAuthContext) => ({
  ...resolveBaseAuthConfig(),
  ...auth,
});

export const getAuthConfig = (): AuthConfig => {
  const base = resolveBaseAuthConfig();
  return mergeAuthConfig(base, {
    kind: 'platform',
    issuer: requireEnv('SVA_AUTH_ISSUER'),
    clientId: requireEnv('SVA_AUTH_CLIENT_ID'),
    redirectUri: requireEnv('SVA_AUTH_REDIRECT_URI'),
    postLogoutRedirectUri: requireEnv('SVA_AUTH_POST_LOGOUT_REDIRECT_URI'),
  });
};

export const resolveAuthConfigForInstance = async (
  instanceId: string,
  options: { origin?: string; protocol?: string } = {}
): Promise<AuthConfig> => {
  const instance = await loadInstanceById(instanceId);
  if (!instance || !isTrafficEnabledInstanceStatus(instance.status)) {
    throw new Error(`Active instance auth config not found for ${instanceId}`);
  }

  const origin = options.origin ?? buildHostOrigin(instance.primaryHostname, options.protocol);
  const tenantSecret = await resolveTenantAuthClientSecret(instance.instanceId);
  return mergeAuthConfig(resolveBaseAuthConfig({ clientSecret: tenantSecret.secret }), {
    kind: 'instance',
    instanceId: instance.instanceId,
    authRealm: instance.authRealm,
    issuer: buildIssuerUrl(instance.authRealm, instance.authIssuerUrl),
    clientId: instance.authClientId,
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: `${origin}/`,
  });
};

export const resolveAuthConfigForRequest = async (request: Request): Promise<AuthConfig> => {
  const host = resolveRequestHost(request);
  const requestOrigin = buildRequestOrigin(request);

  const instanceConfig = getInstanceConfig();
  if (!instanceConfig) {
    logInstanceConfigMissing(host, requestOrigin);
    return getAuthConfig();
  }

  if (isCanonicalAuthHost(host)) {
    logGlobalAuthResolution(request, host, requestOrigin);
    return getAuthConfig();
  }

  const hostClassification = classifyHost(host, instanceConfig.parentDomain);
  if (hostClassification.kind === 'root') {
    logGlobalAuthResolution(request, host, requestOrigin);
    return getAuthConfig();
  }

  if (hostClassification.kind !== 'tenant') {
    logTenantAuthResolutionFailure(request, {
      host,
      requestOrigin,
      reason: 'tenant_host_invalid',
    });
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_host_invalid',
      publicMessage:
        'Anmeldung ist für diese Host-Konfiguration nicht verfügbar. Bitte die Adresse prüfen oder den Support kontaktieren.',
    });
  }

  const registryEntry = await loadRegistryEntryForHost(host, requestOrigin);
  if (!registryEntry) {
    logTenantAuthResolutionFailure(request, {
      host,
      requestOrigin,
      reason: 'tenant_not_found',
    });
    throw new TenantAuthResolutionError({
      host,
      reason: 'tenant_not_found',
    });
  }

  assertActiveRegistryEntry(host, requestOrigin, registryEntry);
  const tenantSecret = await resolveTenantAuthClientSecret(registryEntry.instanceId);
  const authConfig = mergeAuthConfig(resolveBaseAuthConfig({ clientSecret: tenantSecret.secret }), {
    kind: 'instance',
    instanceId: registryEntry.instanceId,
    authRealm: registryEntry.authRealm,
    issuer: buildIssuerUrl(registryEntry.authRealm, registryEntry.authIssuerUrl),
    clientId: registryEntry.authClientId,
    redirectUri: `${requestOrigin}/auth/callback`,
    postLogoutRedirectUri: `${requestOrigin}/`,
  });
  logTenantAuthResolution(request, host, requestOrigin, authConfig, registryEntry, tenantSecret);
  return authConfig;
};
