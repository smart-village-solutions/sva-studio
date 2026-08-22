import { createHash } from 'node:crypto';
import * as client from 'openid-client';

import { getAuthConfig } from './config.js';
import type { AuthConfig } from './types.js';

const configPromises = new Map<string, Promise<client.Configuration>>();
const MAX_OIDC_CONFIG_CACHE_ENTRIES = 32;

const buildOidcConfigCacheKey = (
  authConfig: Pick<AuthConfig, 'issuer' | 'clientId' | 'clientSecret'>
): string => {
  const secretFingerprint = createHash('sha256')
    .update(authConfig.clientSecret)
    .digest('hex')
    .slice(0, 16);
  return `${authConfig.issuer}::${authConfig.clientId}::${secretFingerprint}`;
};

const evictOldestOidcConfig = (): void => {
  if (configPromises.size < MAX_OIDC_CONFIG_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = configPromises.keys().next().value;
  if (oldestKey) {
    configPromises.delete(oldestKey);
  }
};

/**
 * Returns a cached OpenID Connect client configuration.
 *
 * Lazily discovers the issuer configuration on first call and reuses it
 * for subsequent requests to avoid repeated discovery network calls.
 */
export const getOidcConfig = async (
  authConfig: Pick<AuthConfig, 'issuer' | 'clientId' | 'clientSecret'> = getAuthConfig()
): Promise<client.Configuration> => {
  const cacheKey = buildOidcConfigCacheKey(authConfig);
  const cached = configPromises.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = client
    .discovery(new URL(authConfig.issuer), authConfig.clientId, authConfig.clientSecret)
    .catch((error: unknown) => {
      configPromises.delete(cacheKey);
      throw error;
    });

  evictOldestOidcConfig();
  configPromises.set(cacheKey, promise);
  return promise;
};

export const invalidateOidcConfig = (
  authConfig: Pick<AuthConfig, 'issuer' | 'clientId' | 'clientSecret'> = getAuthConfig()
): void => {
  configPromises.delete(buildOidcConfigCacheKey(authConfig));
};

export { client };
