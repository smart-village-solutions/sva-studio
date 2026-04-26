import { loadInstanceById } from '@sva/data-repositories/server';

import { resolveTenantAdminClientSecret } from './config-tenant-secret.js';
import { getKeycloakAdminClientSecret } from './runtime-secrets.js';

export type IdentityUserAttributes = Readonly<Record<string, readonly string[]>>;

type KeycloakClientConfig = {
  readonly baseUrl: string;
  readonly realm: string;
  readonly adminRealm: string;
  readonly clientId: string;
  readonly clientSecret: string;
};

type IdentityProviderResolution = {
  readonly provider: {
    getUserAttributes(externalId: string, attributeNames?: readonly string[]): Promise<IdentityUserAttributes>;
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

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

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
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly adminRealm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private cachedToken?: { readonly value: string; readonly expiresAtMs: number };

  constructor(config: KeycloakClientConfig) {
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
    const response = await fetch(
      `${this.baseUrl}/admin/realms/${encodePathSegment(this.realm)}/users/${encodePathSegment(externalId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Keycloak get_user_attributes failed with HTTP ${response.status}`);
    }

    const user = (await response.json()) as { attributes?: IdentityUserAttributes };
    return filterUserAttributes(user.attributes, attributeNames);
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
    const response = await fetch(
      `${this.baseUrl}/realms/${encodePathSegment(this.adminRealm)}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );
    if (!response.ok) {
      throw new Error(`Keycloak fetch_token failed with HTTP ${response.status}`);
    }

    const parsed = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof parsed.access_token !== 'string' || !parsed.access_token) {
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
    return null;
  }
};

export const resolveIdentityProviderForInstance = async (
  instanceId: string
): Promise<IdentityProviderResolution | null> => {
  const instance = await loadInstanceById(instanceId).catch(() => null);
  if (!instance?.tenantAdminClient?.clientId) {
    return null;
  }

  const tenantSecret = await resolveTenantAdminClientSecret(instanceId);
  if (!tenantSecret.secret) {
    return null;
  }

  try {
    return {
      provider: new KeycloakUserAttributeReader({
        baseUrl: requireEnv('KEYCLOAK_ADMIN_BASE_URL'),
        realm: instance.authRealm,
        adminRealm: instance.authRealm,
        clientId: instance.tenantAdminClient.clientId,
        clientSecret: tenantSecret.secret,
      }),
    };
  } catch {
    return null;
  }
};

export const trackKeycloakCall = async <T>(
  _operation: string,
  execute: () => Promise<T>
): Promise<T> => execute();
