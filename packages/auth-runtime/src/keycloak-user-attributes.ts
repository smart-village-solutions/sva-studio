import { loadInstanceById } from '@sva/data-repositories/server';
import { createSdkLogger } from '@sva/server-runtime';

import { resolveTenantAdminClientSecret } from './config-tenant-secret.js';
import { getKeycloakAdminClientSecret } from './runtime-secrets.js';

export type IdentityUserAttributes = Readonly<Record<string, readonly string[]>>;

const logger = createSdkLogger({ component: 'keycloak-user-attributes' });
const REQUEST_TIMEOUT_MS = 10_000;

const logResolutionFailure = (
  reasonCode:
    | 'instance_lookup_failed'
    | 'instance_not_found'
    | 'tenant_admin_client_missing'
    | 'tenant_admin_client_secret_lookup_failed'
    | 'tenant_admin_client_secret_missing'
    | 'tenant_admin_client_secret_unreadable'
    | 'configuration_missing',
  instanceId?: string
): void => {
  logger.warn('keycloak_user_attributes_unavailable', {
    operation: 'resolve_identity_provider',
    reason_code: reasonCode,
    ...(instanceId ? { instance_id: instanceId } : {}),
  });
};

const readKeycloakJson = async (
  url: string,
  init: RequestInit,
  operation: 'fetch_token' | 'get_user_attributes',
  instanceId?: string
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  let reasonCode = 'network_error';
  let httpStatus: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reasonCode = 'timeout';
      controller.abort();
      reject(new Error('Keycloak request timed out'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) {
          reasonCode = 'http_error';
          httpStatus = response.status;
          throw new Error(`Keycloak ${operation} failed with HTTP ${response.status}`);
        }
        reasonCode = 'invalid_response';
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('Invalid Keycloak response');
        }
        return payload as Record<string, unknown>;
      })(),
      timeout,
    ]);
  } catch (error) {
    logger.warn('keycloak_user_attributes_unavailable', {
      operation,
      reason_code: reasonCode,
      ...(instanceId ? { instance_id: instanceId } : {}),
      ...(httpStatus === undefined ? {} : { http_status: httpStatus }),
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

type KeycloakClientConfig = {
  readonly instanceId?: string;
  readonly baseUrl: string;
  readonly realm: string;
  readonly adminRealm: string;
  readonly clientId: string;
  readonly clientSecret: string;
};

type IdentityProviderResolution = {
  readonly provider: {
    getUserAttributes(
      externalId: string,
      attributeNames?: readonly string[]
    ): Promise<IdentityUserAttributes>;
  };
};

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const normalizeBaseUrl = (value: string): string => {
  let endIndex = value.length;
  while (endIndex > 0 && value[endIndex - 1] === '/') {
    endIndex -= 1;
  }
  return value.slice(0, endIndex);
};

const filterUserAttributes = (
  attributes: IdentityUserAttributes | undefined,
  attributeNames?: readonly string[]
): IdentityUserAttributes => {
  if (!attributeNames || attributeNames.length === 0) {
    return attributes ?? {};
  }

  const filtered: Record<string, readonly string[]> = {};
  for (const attributeName of attributeNames) {
    const value = attributes?.[attributeName];
    if (value) {
      filtered[attributeName] = value;
    }
  }
  return filtered;
};

class KeycloakUserAttributeReader {
  private readonly instanceId?: string;
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly adminRealm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private cachedToken?: { readonly value: string; readonly expiresAtMs: number };

  constructor(config: KeycloakClientConfig) {
    this.instanceId = config.instanceId;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.realm = config.realm;
    this.adminRealm = config.adminRealm;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  async getUserAttributes(
    externalId: string,
    attributeNames?: readonly string[]
  ): Promise<IdentityUserAttributes> {
    const token = await this.getAccessToken();
    const user = await readKeycloakJson(
      `${this.baseUrl}/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      'get_user_attributes',
      this.instanceId
    );
    return filterUserAttributes(
      user.attributes as IdentityUserAttributes | undefined,
      attributeNames
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAtMs - 10_000) {
      return this.cachedToken.value;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const parsed = await readKeycloakJson(
      `${this.baseUrl}/realms/${encodePathSegment(this.adminRealm)}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
      'fetch_token',
      this.instanceId
    );
    if (typeof parsed.access_token !== 'string' || !parsed.access_token) {
      logger.warn('keycloak_user_attributes_unavailable', {
        operation: 'fetch_token',
        reason_code: 'invalid_response',
        ...(this.instanceId ? { instance_id: this.instanceId } : {}),
      });
      throw new Error('Keycloak token response did not include access_token');
    }

    const expiresInSeconds =
      typeof parsed.expires_in === 'number' && Number.isFinite(parsed.expires_in)
        ? parsed.expires_in
        : 60;
    this.cachedToken = {
      value: parsed.access_token,
      expiresAtMs: now + expiresInSeconds * 1_000,
    };
    return parsed.access_token;
  }
}

const createPlatformIdentityProvider = (): IdentityProviderResolution => {
  const realm = requireEnv('KEYCLOAK_ADMIN_REALM');
  const clientSecret = getKeycloakAdminClientSecret() ?? requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET');
  return {
    provider: new KeycloakUserAttributeReader({
      baseUrl: requireEnv('KEYCLOAK_ADMIN_BASE_URL'),
      realm,
      adminRealm: realm,
      clientId: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
      clientSecret,
    }),
  };
};

export const resolveIdentityProvider = (): IdentityProviderResolution | null => {
  try {
    return createPlatformIdentityProvider();
  } catch {
    logResolutionFailure('configuration_missing');
    return null;
  }
};

export const resolveIdentityProviderForInstance = async (
  instanceId: string
): Promise<IdentityProviderResolution | null> => {
  let instance: Awaited<ReturnType<typeof loadInstanceById>>;
  try {
    instance = await loadInstanceById(instanceId);
  } catch {
    logResolutionFailure('instance_lookup_failed', instanceId);
    return null;
  }
  if (!instance) {
    logResolutionFailure('instance_not_found', instanceId);
    return null;
  }
  if (!instance.tenantAdminClient?.clientId) {
    logResolutionFailure('tenant_admin_client_missing', instanceId);
    return null;
  }

  const tenantSecret = await resolveTenantAdminClientSecret(instanceId);
  if (!tenantSecret.secret) {
    const reason = tenantSecret.reason;
    logResolutionFailure(
      reason === 'tenant_admin_client_secret_lookup_failed' ||
        reason === 'tenant_admin_client_secret_unreadable'
        ? reason
        : 'tenant_admin_client_secret_missing',
      instanceId
    );
    return null;
  }

  try {
    return {
      provider: new KeycloakUserAttributeReader({
        instanceId,
        baseUrl: requireEnv('KEYCLOAK_ADMIN_BASE_URL'),
        realm: instance.authRealm,
        adminRealm: instance.authRealm,
        clientId: instance.tenantAdminClient.clientId,
        clientSecret: tenantSecret.secret,
      }),
    };
  } catch {
    logResolutionFailure('configuration_missing', instanceId);
    return null;
  }
};

export const trackKeycloakCall = async <T>(
  _operation: string,
  execute: () => Promise<T>
): Promise<T> => execute();
