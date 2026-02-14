import * as client from 'openid-client';

import { getAuthConfig } from './config';

let configPromise: Promise<client.Configuration> | undefined;

/**
 * Returns a cached OpenID Connect client configuration.
 *
 * Lazily discovers the issuer configuration on first call and reuses it
 * for subsequent requests to avoid repeated discovery network calls.
 */
export const getOidcConfig = async (): Promise<client.Configuration> => {
  if (!configPromise) {
    const { issuer, clientId, clientSecret } = getAuthConfig();
    configPromise = client.discovery(new URL(issuer), clientId, clientSecret);
  }
  return configPromise;
};

export { client };
