import type { IamMainserverCredentialStatus } from '@sva/core';

import type { IdentityUserAttributes } from './keycloak-user-attributes.js';
import {
  resolveIdentityProvider,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
} from './keycloak-user-attributes.js';
import {
  LEGACY_MAINSERVER_API_KEY_ATTRIBUTE,
  LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE,
  MAINSERVER_APPLICATION_ID_ATTRIBUTE,
  MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
  normalizeMainserverCredentialAttributeValue,
  resolveMainserverCredentialReadiness,
  type MainserverCredentialReadiness,
  type SvaMainserverCredentials,
} from './mainserver-credential-readiness.js';

export {
  createMainserverCredentialFingerprint,
  LEGACY_MAINSERVER_API_KEY_ATTRIBUTE,
  LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE,
  MAINSERVER_APPLICATION_ID_ATTRIBUTE,
  MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
  resolveMainserverCredentialReadiness,
  verifyMainserverCredentialReadback,
} from './mainserver-credential-readiness.js';
export type {
  MainserverCredentialReadback,
  MainserverCredentialReadiness,
  SvaMainserverCredentials,
} from './mainserver-credential-readiness.js';

export type MainserverCredentialState = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

type ReadSvaMainserverCredentialsResult =
  | {
      readonly status: 'ok';
      readonly credentials: SvaMainserverCredentials;
    }
  | {
      readonly status: 'missing_credentials';
    }
  | {
      readonly status: 'partial_credentials';
      readonly missingAttributeNames: readonly [
        typeof MAINSERVER_APPLICATION_ID_ATTRIBUTE | typeof MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
      ];
    }
  | {
      readonly status: 'identity_provider_unavailable';
    };

type ReadIdentityUserAttributesInput = {
  readonly keycloakSubject: string;
  readonly attributeNames?: readonly string[];
  readonly instanceId?: string;
};

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

const resolveAttributeFromCandidates = (
  attributes: IdentityUserAttributes | null | undefined,
  attributeNames: readonly string[]
): string | null => {
  for (const attributeName of attributeNames) {
    const value = normalizeMainserverCredentialAttributeValue(attributes?.[attributeName]);
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
  const readiness = resolveMainserverCredentialReadiness(attributes);
  if (readiness.status === 'ready') {
    return {
      mainserverUserApplicationId: readiness.credentials.apiKey,
      mainserverUserApplicationSecretSet: true,
    };
  }
  if (readiness.status === 'unavailable' || readiness.status === 'missing') {
    return { mainserverUserApplicationSecretSet: false };
  }

  const applicationIdMissing = readiness.missingAttributeNames.includes(
    MAINSERVER_APPLICATION_ID_ATTRIBUTE
  );
  const applicationId = applicationIdMissing
    ? null
    : resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_ID_ATTRIBUTE_NAMES);

  return {
    mainserverUserApplicationId: applicationId ?? undefined,
    mainserverUserApplicationSecretSet: !readiness.missingAttributeNames.includes(
      MAINSERVER_APPLICATION_SECRET_ATTRIBUTE
    ),
  };
};

export const resolveMainserverCredentialStatus = (
  attributes: IdentityUserAttributes | null | undefined
): IamMainserverCredentialStatus => {
  if (attributes === null || attributes === undefined) {
    return 'unknown';
  }

  const readiness = resolveMainserverCredentialReadiness(attributes);
  if (readiness.status === 'ready') {
    return 'complete';
  }
  if (readiness.status === 'missing') {
    return 'missing_both';
  }
  if (readiness.status === 'unavailable') {
    return 'unknown';
  }
  return readiness.missingAttributeNames.includes(MAINSERVER_APPLICATION_SECRET_ATTRIBUTE)
    ? 'missing_application_secret'
    : 'missing_application_id';
};

export const buildMainserverIdentityAttributes = (input: {
  readonly existingAttributes: IdentityUserAttributes | null | undefined;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
}): Record<string, readonly string[]> => {
  const attributes = copyIdentityAttributes(input.existingAttributes);
  const readiness = resolveMainserverCredentialReadiness(attributes);
  const currentState = resolveMainserverCredentialState(attributes);
  const preservedSecret =
    readiness.status === 'ready'
      ? readiness.credentials.apiSecret
      : readiness.status === 'partial' &&
          !readiness.missingAttributeNames.includes(MAINSERVER_APPLICATION_SECRET_ATTRIBUTE)
        ? resolveAttributeFromCandidates(attributes, MAINSERVER_APPLICATION_SECRET_ATTRIBUTE_NAMES)
        : null;

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

  const nextSecret = input.mainserverUserApplicationSecret?.trim();
  if (nextSecret) {
    attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE] = [nextSecret];
  } else if (preservedSecret) {
    attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE] = [preservedSecret];
  } else {
    delete attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE];
  }

  return attributes;
};

export const readIdentityUserAttributes = async (
  input: ReadIdentityUserAttributesInput
): Promise<IdentityUserAttributes | null> => {
  try {
    const identityProvider = input.instanceId
      ? await resolveIdentityProviderForInstance(input.instanceId)
      : resolveIdentityProvider();
    if (!identityProvider) {
      return null;
    }

    return await trackKeycloakCall('get_user_attributes', () =>
      identityProvider.provider.getUserAttributes(input.keycloakSubject, input.attributeNames)
    );
  } catch {
    return null;
  }
};

export const readSvaMainserverCredentials = async (
  keycloakSubject: string,
  instanceId?: string
): Promise<SvaMainserverCredentials | null> => {
  const result = await readSvaMainserverCredentialsWithStatus(keycloakSubject, instanceId);
  if (result.status !== 'ok') {
    return null;
  }

  return result.credentials;
};

export const readSvaMainserverCredentialReadiness = async (
  keycloakSubject: string,
  instanceId?: string
): Promise<MainserverCredentialReadiness> => {
  const attributes = await readIdentityUserAttributes({
    keycloakSubject,
    attributeNames: getSvaMainserverCredentialAttributeNames(),
    instanceId,
  });
  return resolveMainserverCredentialReadiness(attributes);
};

export const readSvaMainserverCredentialsWithStatus = async (
  keycloakSubject: string,
  instanceId?: string
): Promise<ReadSvaMainserverCredentialsResult> => {
  const readiness = await readSvaMainserverCredentialReadiness(keycloakSubject, instanceId);
  if (readiness.status === 'unavailable') {
    return {
      status: 'identity_provider_unavailable',
    };
  }
  if (readiness.status === 'partial') {
    return {
      status: 'partial_credentials',
      missingAttributeNames: readiness.missingAttributeNames,
    };
  }
  if (readiness.status === 'missing') {
    return {
      status: 'missing_credentials',
    };
  }

  return {
    status: 'ok',
    credentials: readiness.credentials,
  };
};
