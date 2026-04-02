import type { AuthConfig, SessionAuthContext } from './types.js';
import { isTrafficEnabledInstanceStatus, normalizeHost } from '@sva/core';
import { loadInstanceByHostname, loadInstanceById } from '@sva/data/server';
import { getInstanceConfig } from '@sva/sdk/server';
import { getAuthClientSecret, getAuthStateSecret } from './runtime-secrets.server.js';

/**
 * Reads a required environment variable or throws.
 */
const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

/**
 * Parses a numeric environment variable with a fallback.
 */
const readNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveBaseAuthConfig = () => {
  const clientSecret = getAuthClientSecret();
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

const buildRequestOrigin = (request: Request): string => {
  const url = new URL(request.url);
  return url.origin;
};

const buildHostOrigin = (hostname: string, protocol = 'https'): string => `${protocol}://${normalizeHost(hostname)}`;

const mergeAuthConfig = (
  base: ReturnType<typeof resolveBaseAuthConfig>,
  overrides: Pick<AuthConfig, 'issuer' | 'clientId' | 'redirectUri' | 'postLogoutRedirectUri'> &
    Partial<Pick<AuthConfig, 'instanceId' | 'authRealm'>>
): AuthConfig => ({
  ...base,
  ...overrides,
  clientSecret: base.clientSecret,
  loginStateSecret: base.loginStateSecret,
});

export const resolveAuthConfigFromSessionAuth = (auth: SessionAuthContext) => ({
  ...resolveBaseAuthConfig(),
  ...auth,
});

/**
 * Builds the auth configuration from environment variables.
 */
export const getAuthConfig = (): AuthConfig => {
  const base = resolveBaseAuthConfig();
  return mergeAuthConfig(base, {
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
  return mergeAuthConfig(resolveBaseAuthConfig(), {
    instanceId: instance.instanceId,
    authRealm: instance.authRealm,
    issuer: buildIssuerUrl(instance.authRealm, instance.authIssuerUrl),
    clientId: instance.authClientId,
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: `${origin}/`,
  });
};

export const resolveAuthConfigForRequest = async (request: Request): Promise<AuthConfig> => {
  const host = normalizeHost(new URL(request.url).host);
  const instanceConfig = getInstanceConfig();
  if (!instanceConfig) {
    return getAuthConfig();
  }

  const registryEntry = await loadInstanceByHostname(host).catch(() => null);
  if (!registryEntry) {
    return getAuthConfig();
  }

  if (!isTrafficEnabledInstanceStatus(registryEntry.status)) {
    throw new Error(`Tenant host ${host} is not active`);
  }

  return mergeAuthConfig(resolveBaseAuthConfig(), {
    instanceId: registryEntry.instanceId,
    authRealm: registryEntry.authRealm,
    issuer: buildIssuerUrl(registryEntry.authRealm, registryEntry.authIssuerUrl),
    clientId: registryEntry.authClientId,
    redirectUri: `${buildRequestOrigin(request)}/auth/callback`,
    postLogoutRedirectUri: `${buildRequestOrigin(request)}/`,
  });
};
