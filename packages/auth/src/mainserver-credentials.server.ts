import type { IdentityUserAttributes } from './identity-provider-port';
import { resolveIdentityProvider, trackKeycloakCall } from './iam-account-management/shared';

export type SvaMainserverCredentials = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

export type ReadIdentityUserAttributesInput = {
  readonly keycloakSubject: string;
  readonly attributeNames?: readonly string[];
};

const MAINSERVER_API_KEY_ATTRIBUTE = 'sva_mainserver_api_key';
const MAINSERVER_API_SECRET_ATTRIBUTE = 'sva_mainserver_api_secret';

const normalizeAttributeValue = (value: readonly string[] | undefined): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const candidate = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return candidate?.trim() ?? null;
};

export const readIdentityUserAttributes = async (
  input: ReadIdentityUserAttributesInput
): Promise<IdentityUserAttributes | null> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return null;
  }

  return trackKeycloakCall('get_user_attributes', () =>
    identityProvider.provider.getUserAttributes(input.keycloakSubject, input.attributeNames)
  );
};

export const readSvaMainserverCredentials = async (
  keycloakSubject: string
): Promise<SvaMainserverCredentials | null> => {
  const attributes = await readIdentityUserAttributes({
    keycloakSubject,
    attributeNames: [MAINSERVER_API_KEY_ATTRIBUTE, MAINSERVER_API_SECRET_ATTRIBUTE],
  });
  if (!attributes) {
    return null;
  }

  const apiKey = normalizeAttributeValue(attributes[MAINSERVER_API_KEY_ATTRIBUTE]);
  const apiSecret = normalizeAttributeValue(attributes[MAINSERVER_API_SECRET_ATTRIBUTE]);
  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
};
