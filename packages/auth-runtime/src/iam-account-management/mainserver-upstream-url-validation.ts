import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';
import { normalizePublicUpstreamUrl } from '../upstream-url-validation.js';

export const normalizeProvisioningUpstreamUrl = async (
  value: string,
  fieldName: 'graphql_base_url' | 'oauth_token_url'
): Promise<string> => {
  const normalizedUrl = await normalizePublicUpstreamUrl(value);

  if (!normalizedUrl) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode: 409,
    });
  }

  return normalizedUrl;
};
