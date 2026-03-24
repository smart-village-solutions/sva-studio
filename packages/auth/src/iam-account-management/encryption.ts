import {
  decryptFieldValue,
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';

import { parseBooleanFlag } from './feature-flags.js';

let encryptionConfigCache: { signature: string; config: FieldEncryptionConfig | null } | null = null;

export const getEncryptionConfig = (): FieldEncryptionConfig | null => {
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

export const protectField = (value: string | undefined, aad: string): string | null => {
  if (!value) {
    return null;
  }
  const config = getEncryptionConfig();
  if (!config) {
    const allowPlaintextFallback =
      process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK !== undefined
        ? parseBooleanFlag(process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK, false)
        : process.env.NODE_ENV !== 'production';
    if (!allowPlaintextFallback) {
      throw new Error('pii_encryption_required:PII-Verschlüsselung ist nicht konfiguriert.');
    }
    return value;
  }
  return encryptFieldValue(value, config, aad);
};

export const revealField = (value: string | null | undefined, aad: string): string | undefined => {
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
