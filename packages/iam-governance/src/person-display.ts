import {
  decryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';

let encryptionConfigCache: { signature: string; config: FieldEncryptionConfig | null } | null = null;

const getEncryptionConfig = (): FieldEncryptionConfig | null => {
  const activeKeyId = process.env.IAM_PII_ACTIVE_KEY_ID ?? '';
  const keyring = process.env.IAM_PII_KEYRING_JSON ?? '';
  const signature = `${activeKeyId}::${keyring}`;
  if (encryptionConfigCache?.signature === signature) {
    return encryptionConfigCache.config;
  }

  const config = parseFieldEncryptionConfigFromEnv(process.env);
  encryptionConfigCache = { signature, config };
  return config;
};

export const revealGovernanceField = (value: string | null | undefined, aad: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (!value.startsWith('enc:v1:')) {
    return value;
  }

  let config: FieldEncryptionConfig | null;
  try {
    config = getEncryptionConfig();
  } catch {
    return undefined;
  }
  if (!config) {
    return undefined;
  }

  try {
    return decryptFieldValue(value, config.keyring, aad);
  } catch {
    return undefined;
  }
};

export const resolveGovernancePersonDisplayName = (input: {
  decryptedDisplayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  keycloakSubject: string;
}): string => {
  const fullName = [input.firstName, input.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  if (input.decryptedDisplayName && input.decryptedDisplayName.trim().length > 0) {
    return input.decryptedDisplayName;
  }

  return fullName || input.keycloakSubject;
};
