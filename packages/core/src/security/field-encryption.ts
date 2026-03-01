import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION_PREFIX = 'enc:v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

export type FieldEncryptionKeyring = Record<string, string>;

export type FieldEncryptionConfig = {
  activeKeyId: string;
  keyring: FieldEncryptionKeyring;
};

type FieldEncryptionError = Error & {
  context?: Readonly<Record<string, string>>;
};

const createFieldEncryptionError = (
  message: string,
  context?: Readonly<Record<string, string>>
): FieldEncryptionError => {
  const error = new Error(message) as FieldEncryptionError;
  if (context) {
    error.context = context;
  }
  return error;
};

const decodeBase64Key = (keyMaterialBase64: string): Buffer => {
  const decoded = Buffer.from(keyMaterialBase64, 'base64');
  if (decoded.length !== 32) {
    throw new Error('Invalid encryption key length. Expected 32-byte base64 key.');
  }
  return decoded;
};

const getKeyMaterial = (keyring: FieldEncryptionKeyring, keyId: string): Buffer => {
  const keyMaterial = keyring[keyId];
  if (!keyMaterial) {
    throw createFieldEncryptionError('Requested encryption key is not configured in keyring.', {
      keyId,
    });
  }
  return decodeBase64Key(keyMaterial);
};

export const encryptFieldValue = (
  plaintext: string,
  config: FieldEncryptionConfig,
  aad?: string
): string => {
  const key = getKeyMaterial(config.keyring, config.activeKeyId);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    config.activeKeyId,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

export const decryptFieldValue = (
  encryptedPayload: string,
  keyring: FieldEncryptionKeyring,
  aad?: string
): string => {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 6) {
    throw new Error('Invalid encrypted payload format.');
  }

  const [prefixPartA, prefixPartB, keyId, ivBase64, authTagBase64, ciphertextBase64] = parts;
  const prefix = `${prefixPartA}:${prefixPartB}`;

  if (prefix !== VERSION_PREFIX || !keyId || !ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted payload format.');
  }

  const key = getKeyMaterial(keyring, keyId);
  const iv = Buffer.from(ivBase64, 'base64url');
  const authTag = Buffer.from(authTagBase64, 'base64url');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64url');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  if (aad) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};

export const parseFieldEncryptionConfigFromEnv = (
  env: NodeJS.ProcessEnv
): FieldEncryptionConfig | null => {
  const activeKeyId = env.IAM_PII_ACTIVE_KEY_ID;
  const keyringJson = env.IAM_PII_KEYRING_JSON;

  if (!activeKeyId || !keyringJson) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(keyringJson);
  } catch {
    throw new Error('Invalid IAM_PII_KEYRING_JSON: not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid IAM_PII_KEYRING_JSON: expected key-value object.');
  }

  const keyring: FieldEncryptionKeyring = {};
  for (const [keyId, keyValue] of Object.entries(parsed)) {
    if (typeof keyValue !== 'string' || keyValue.length === 0) {
      throw new Error('Invalid key material detected in keyring entry.');
    }
    decodeBase64Key(keyValue);
    keyring[keyId] = keyValue;
  }

  if (!keyring[activeKeyId]) {
    throw createFieldEncryptionError('IAM_PII_ACTIVE_KEY_ID references a key not present in keyring.', {
      activeKeyId,
    });
  }

  return {
    activeKeyId,
    keyring,
  };
};
