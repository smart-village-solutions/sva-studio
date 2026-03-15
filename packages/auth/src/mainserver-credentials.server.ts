import type { IdentityUserAttributes } from './identity-provider-port';
import { resolveIdentityProvider, trackKeycloakCall } from './iam-account-management/shared';

export type SvaMainserverCredentials = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

export type MainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type ReadSvaMainserverCredentialsResult =
  | {
      readonly status: 'ok';
      readonly credentials: SvaMainserverCredentials;
    }
  | {
      readonly status: 'missing_credentials';
    }
  | {
      readonly status: 'identity_provider_unavailable';
    };

export type ReadIdentityUserAttributesInput = {
  readonly keycloakSubject: string;
  readonly attributeNames?: readonly string[];
};

export const MAINSERVER_APPLICATION_ID_ATTRIBUTE = 'mainserverUserApplicationId';
export const MAINSERVER_APPLICATION_SECRET_ATTRIBUTE = 'mainserverUserApplicationSecret';
export const LEGACY_MAINSERVER_API_KEY_ATTRIBUTE = 'sva_mainserver_api_key';
export const LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE = 'sva_mainserver_api_secret';

const MAINSERVER_APPLICATION_ID_ATTRIBUTE_NAMES = [
  MAINSERVER_APPLICATION_ID_ATTRIBUTE,
  LEGACY_MAINSERVER_API_KEY_ATTRIBUTE,
] as const;
const MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES = [
  MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
  LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE,
] as const;

export const getSvaMainserverCredentialAttributeNames = (): readonly string[] => [
  ...MAINSERVER_APPLICATION_ID_ATTRIBUTE_NAMES,
  ...MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES,
];

const normalizeAttributeValue = (value: readonly string[] | undefined): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const candidate = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return candidate?.trim() ?? null;
};

const resolveAttributeFromCandidates = (
  attributes: IdentityUserAttributes | null | undefined,
  attributeNames: readonly string[]
): string | null => {
  for (const attributeName of attributeNames) {
    const value = normalizeAttributeValue(attributes?.[attributeName]);
    if (value) {
      return value;
    }
  }

  return null;
};

const copyIdentityAttributes = (
  attributes: IdentityUserAttributes | null | undefined
): Record<string, readonly string[]> => ({ ...(attributes ?? {}) });

export const resolveMainserverCredentialState = (
  attributes: IdentityUserAttributes | null | undefined
): MainserverCredentialState => {
  const applicationId = resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_ID_ATTRIBUTE_NAMES);
  const applicationSecret = resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES);

  return {
    mainserverUserApplicationId: applicationId ?? undefined,
    mainserverUserApplicationSecretSet: applicationSecret !== null,
  };
};

export const buildMainserverIdentityAttributes = (input: {
  readonly existingAttributes: IdentityUserAttributes | null | undefined;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
}): Record<string, readonly string[]> => {
  const attributes = copyIdentityAttributes(input.existingAttributes);
  const currentState = resolveMainserverCredentialState(attributes);
  const preservedSecret = resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES);

  delete attributes[LEGACY_MAINSERVER_API_KEY_ATTRIBUTE];
  delete attributes[LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE];

  const nextApplicationId =
    input.mainserverUserApplicationId !== undefined
      ? input.mainserverUserApplicationId.trim()
      : currentState.mainserverUserApplicationId;
  if (nextApplicationId) {
    attributes[MAINSERVER_APPLICATION_ID_ATTRIBUTE] = [nextApplicationId];
  } else {
    delete attributes[MAINSERVER_APPLICATION_ID_ATTRIBUTE];
  }

  if (input.mainserverUserApplicationSecret !== undefined) {
    const nextSecret = input.mainserverUserApplicationSecret.trim();
    if (nextSecret) {
      attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE] = [nextSecret];
    }
  } else if (currentState.mainserverUserApplicationSecretSet) {
    if (preservedSecret) {
      attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE] = [preservedSecret];
    }
  }

  return attributes;
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
  const result = await readSvaMainserverCredentialsWithStatus(keycloakSubject);
  if (result.status !== 'ok') {
    return null;
  }

  return result.credentials;
};

export const readSvaMainserverCredentialsWithStatus = async (
  keycloakSubject: string
): Promise<ReadSvaMainserverCredentialsResult> => {
  const attributes = await readIdentityUserAttributes({
    keycloakSubject,
    attributeNames: getSvaMainserverCredentialAttributeNames(),
  });
  if (!attributes) {
    return {
      status: 'identity_provider_unavailable',
    };
  }

  const apiKey = resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_ID_ATTRIBUTE_NAMES);
  const apiSecret = resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES);
  if (!apiKey || !apiSecret) {
    return {
      status: 'missing_credentials',
    };
  }

  return {
    status: 'ok',
    credentials: { apiKey, apiSecret },
  };
};
