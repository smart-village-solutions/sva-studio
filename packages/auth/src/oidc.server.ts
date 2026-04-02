import * as client from 'openid-client';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import { getAuthConfig } from './config.js';
import type { AuthConfig } from './types.js';

const configPromises = new Map<string, Promise<client.Configuration>>();
const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const MAX_OIDC_CONFIG_CACHE_ENTRIES = 32;

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
  const cacheKey = `${authConfig.issuer}::${authConfig.clientId}`;
  const cached = configPromises.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = client.discovery(new URL(authConfig.issuer), authConfig.clientId, authConfig.clientSecret).catch(
    (error: unknown) => {
      const context = getWorkspaceContext();
      configPromises.delete(cacheKey);
      logger.error('OIDC discovery failed', {
        operation: 'oidc_discovery',
        issuer: authConfig.issuer,
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        workspace_id: context.workspaceId ?? 'default',
        request_id: context.requestId,
        trace_id: context.traceId,
      });
      throw error;
    }
  );

  evictOldestOidcConfig();
  configPromises.set(cacheKey, promise);
  return promise;
};

export { client };
