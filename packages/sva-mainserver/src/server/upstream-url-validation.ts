import { normalizePublicUpstreamUrl } from '@sva/auth-runtime/server';

import { SvaMainserverError } from './errors.js';

export const normalizeSvaMainserverUpstreamUrl = async (
  value: string,
  fieldName: 'graphql_base_url' | 'oauth_token_url',
  statusCode: number
): Promise<string> => {
  const normalizedUrl = await normalizePublicUpstreamUrl(value);

  if (!normalizedUrl) {
    throw new SvaMainserverError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode,
    });
  }

  return normalizedUrl;
};
