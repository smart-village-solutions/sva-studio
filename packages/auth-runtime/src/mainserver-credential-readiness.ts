import { scryptSync } from 'node:crypto';

import type { IdentityUserAttributes } from './keycloak-user-attributes.js';

export const MAINSERVER_APPLICATION_ID_ATTRIBUTE = 'mainserverUserApplicationId';
export const MAINSERVER_APPLICATION_SECRET_ATTRIBUTE = 'mainserverUserApplicationSecret';
export const LEGACY_MAINSERVER_API_KEY_ATTRIBUTE = 'sva_mainserver_api_key';
export const LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE = 'sva_mainserver_api_secret';

export type SvaMainserverCredentials = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

export type MainserverCredentialReadiness =
  | {
      readonly status: 'ready';
      readonly attributeSource: 'canonical' | 'legacy';
      readonly credentials: SvaMainserverCredentials;
    }
  | {
      readonly status: 'missing';
      readonly missingAttributeNames: readonly [
        typeof MAINSERVER_APPLICATION_ID_ATTRIBUTE,
        typeof MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
      ];
    }
  | {
      readonly status: 'partial';
      readonly missingAttributeNames: readonly [
        typeof MAINSERVER_APPLICATION_ID_ATTRIBUTE | typeof MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
      ];
    }
  | {
      readonly status: 'unavailable';
    };

export type MainserverCredentialReadback =
  | {
      readonly status: 'ready';
      readonly credentialFingerprint: string;
    }
  | Exclude<MainserverCredentialReadiness, { readonly status: 'ready' }>
  | {
      readonly status: 'stale';
    };

export const normalizeMainserverCredentialAttributeValue = (
  value: readonly string[] | undefined
): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const candidate = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return candidate?.trim() ?? null;
};

export const resolveMainserverCredentialReadiness = (
  attributes: IdentityUserAttributes | null | undefined
): MainserverCredentialReadiness => {
  if (attributes === null || attributes === undefined) {
    return { status: 'unavailable' };
  }

  const canonicalApplicationId = normalizeMainserverCredentialAttributeValue(
    attributes[MAINSERVER_APPLICATION_ID_ATTRIBUTE]
  );
  const canonicalApplicationSecret = normalizeMainserverCredentialAttributeValue(
    attributes[MAINSERVER_APPLICATION_SECRET_ATTRIBUTE]
  );
  const legacyApplicationId = normalizeMainserverCredentialAttributeValue(
    attributes[LEGACY_MAINSERVER_API_KEY_ATTRIBUTE]
  );
  const legacyApplicationSecret = normalizeMainserverCredentialAttributeValue(
    attributes[LEGACY_MAINSERVER_API_SECRET_ATTRIBUTE]
  );

  const hasCanonicalAttribute = Boolean(canonicalApplicationId || canonicalApplicationSecret);
  const applicationId = hasCanonicalAttribute ? canonicalApplicationId : legacyApplicationId;
  const applicationSecret = hasCanonicalAttribute
    ? canonicalApplicationSecret
    : legacyApplicationSecret;
  if (applicationId && applicationSecret) {
    return {
      status: 'ready',
      attributeSource: hasCanonicalAttribute ? 'canonical' : 'legacy',
      credentials: {
        apiKey: applicationId,
        apiSecret: applicationSecret,
      },
    };
  }

  if (!applicationId && !applicationSecret) {
    return {
      status: 'missing',
      missingAttributeNames: [
        MAINSERVER_APPLICATION_ID_ATTRIBUTE,
        MAINSERVER_APPLICATION_SECRET_ATTRIBUTE,
      ],
    };
  }

  return {
    status: 'partial',
    missingAttributeNames: [
      applicationId ? MAINSERVER_APPLICATION_SECRET_ATTRIBUTE : MAINSERVER_APPLICATION_ID_ATTRIBUTE,
    ],
  };
};

export const createMainserverCredentialFingerprint = (input: {
  readonly instanceId: string;
  readonly source: 'organization' | 'user';
  readonly principalId: string;
  readonly credentials: SvaMainserverCredentials;
}): string =>
  scryptSync(
    `${input.credentials.apiKey}\u0000${input.credentials.apiSecret}`,
    `${input.instanceId}\u0000${input.source}\u0000${input.principalId}`,
    32
  ).toString('hex');

export const verifyMainserverCredentialReadback = (input: {
  readonly attributes: IdentityUserAttributes | null | undefined;
  readonly expectedFingerprint: string;
  readonly instanceId: string;
  readonly principalId: string;
}): MainserverCredentialReadback => {
  const readiness = resolveMainserverCredentialReadiness(input.attributes);
  if (readiness.status !== 'ready') {
    return readiness;
  }
  if (readiness.attributeSource !== 'canonical') {
    return { status: 'stale' };
  }

  const credentialFingerprint = createMainserverCredentialFingerprint({
    instanceId: input.instanceId,
    source: 'user',
    principalId: input.principalId,
    credentials: readiness.credentials,
  });
  if (credentialFingerprint !== input.expectedFingerprint) {
    return { status: 'stale' };
  }

  return { status: 'ready', credentialFingerprint };
};
