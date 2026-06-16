import { createSdkLogger } from '@sva/server-runtime';

import { getKeycloakAdminClientSecret } from './runtime-secrets.js';

const logger = createSdkLogger({ component: 'keycloak-account-action-support', level: 'info' });

const UPDATE_EMAIL_FEATURE = 'UPDATE_EMAIL';
const CACHE_TTL_MS = 60_000;

type CachedSupport = {
  readonly supported: boolean;
  readonly expiresAtMs: number;
};

type KeycloakServerInfo = {
  readonly profileInfo?: {
    readonly disabledFeatures?: readonly string[];
  };
};

type KeycloakRequiredAction = {
  readonly alias?: string;
  readonly providerId?: string;
  readonly enabled?: boolean;
};

const updateEmailSupportCache = new Map<string, CachedSupport>();

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const normalizeBaseUrl = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
};

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const readAccessToken = async (): Promise<string> => {
  const clientSecret = getKeycloakAdminClientSecret() ?? requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET');
  const response = await fetch(
    `${normalizeBaseUrl(requireEnv('KEYCLOAK_ADMIN_BASE_URL'))}/realms/${encodePathSegment(requireEnv('KEYCLOAK_ADMIN_REALM'))}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
        client_secret: clientSecret,
      }).toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Keycloak admin token request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
    throw new Error('Keycloak admin token response did not include access_token');
  }

  return payload.access_token;
};

const fetchServerInfo = async (accessToken: string): Promise<KeycloakServerInfo> => {
  const response = await fetch(`${normalizeBaseUrl(requireEnv('KEYCLOAK_ADMIN_BASE_URL'))}/admin/serverinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Keycloak serverinfo request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as KeycloakServerInfo;
};

const fetchRequiredActions = async (realm: string, accessToken: string): Promise<readonly KeycloakRequiredAction[]> => {
  const response = await fetch(
    `${normalizeBaseUrl(requireEnv('KEYCLOAK_ADMIN_BASE_URL'))}/admin/realms/${encodePathSegment(realm)}/authentication/required-actions`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Keycloak required-actions request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as readonly KeycloakRequiredAction[];
};

const isUpdateEmailDisabledGlobally = (serverInfo: KeycloakServerInfo): boolean =>
  serverInfo.profileInfo?.disabledFeatures?.includes(UPDATE_EMAIL_FEATURE) === true;

const isUpdateEmailEnabledInRealm = (requiredActions: readonly KeycloakRequiredAction[]): boolean =>
  requiredActions.some(
    (action) =>
      (action.providerId === UPDATE_EMAIL_FEATURE || action.alias === UPDATE_EMAIL_FEATURE) && action.enabled === true
  );

export const isUpdateEmailActionSupported = async (realm: string | null | undefined): Promise<boolean> => {
  if (!realm) {
    return false;
  }

  const cachedSupport = updateEmailSupportCache.get(realm);
  if (cachedSupport && cachedSupport.expiresAtMs > Date.now()) {
    return cachedSupport.supported;
  }

  try {
    const accessToken = await readAccessToken();
    const serverInfo = await fetchServerInfo(accessToken);
    if (isUpdateEmailDisabledGlobally(serverInfo)) {
      updateEmailSupportCache.set(realm, {
        supported: false,
        expiresAtMs: Date.now() + CACHE_TTL_MS,
      });
      return false;
    }

    const requiredActions = await fetchRequiredActions(realm, accessToken);
    const supported = isUpdateEmailEnabledInRealm(requiredActions);
    updateEmailSupportCache.set(realm, {
      supported,
      expiresAtMs: Date.now() + CACHE_TTL_MS,
    });
    return supported;
  } catch (error) {
    logger.warn('Keycloak UPDATE_EMAIL support check failed; disabling email self-service flow', {
      operation: 'account_action_support_check',
      realm,
      account_action: 'UPDATE_EMAIL',
      error: error instanceof Error ? error.message : String(error),
    });
    updateEmailSupportCache.set(realm, {
      supported: false,
      expiresAtMs: Date.now() + CACHE_TTL_MS,
    });
    return false;
  }
};
