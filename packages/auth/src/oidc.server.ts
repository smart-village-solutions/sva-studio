import * as client from 'openid-client';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import { getAuthConfig } from './config';

let configPromise: Promise<client.Configuration> | undefined;
const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

/**
 * Returns a cached OpenID Connect client configuration.
 *
 * Lazily discovers the issuer configuration on first call and reuses it
 * for subsequent requests to avoid repeated discovery network calls.
 */
export const getOidcConfig = async (): Promise<client.Configuration> => {
  if (!configPromise) {
    const { issuer, clientId, clientSecret } = getAuthConfig();
    configPromise = client.discovery(new URL(issuer), clientId, clientSecret).catch((error: unknown) => {
      const context = getWorkspaceContext();
      logger.error('OIDC discovery failed', {
        operation: 'oidc_discovery',
        issuer,
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        workspace_id: context.workspaceId ?? 'default',
        request_id: context.requestId,
      });
      throw error;
    });
  }
  return configPromise;
};

export { client };
