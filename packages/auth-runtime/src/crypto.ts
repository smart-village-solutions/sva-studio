import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createSdkLogger } from '@sva/server-runtime';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveKey = (password: string, salt: Buffer): Buffer => scryptSync(password, salt, 32);

export const encryptToken = (token: string, encryptionKey: string): string => {
  if (!token) {
    return token;
  }
  if (!encryptionKey) {
    logger.warn('Token encryption disabled', {
      operation: 'encrypt',
      encryption_key_present: false,
      security_impact: 'tokens_stored_unencrypted',
      recommendation: 'Set ENCRYPTION_KEY environment variable',
    });
    return token;
  }

  try {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = deriveKey(encryptionKey, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(token, 'utf8', 'binary');
    ciphertext += cipher.final('binary');

    return Buffer.concat([
      salt,
      iv,
      Buffer.from(ciphertext, 'binary'),
      cipher.getAuthTag(),
    ]).toString('base64');
  } catch (err) {
    logger.error('Token encryption failed', {
      operation: 'encrypt',
      error: err instanceof Error ? err.message : String(err),
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    });
    throw err;
  }
};

export const decryptToken = (encrypted: string, encryptionKey: string): string => {
  if (!encrypted) {
    return encrypted;
  }
  if (!encryptionKey) {
    logger.warn('Token decryption disabled', {
      operation: 'decrypt',
      encryption_key_present: false,
      security_impact: 'treating_as_unencrypted',
      recommendation: 'Set ENCRYPTION_KEY environment variable',
    });
    return encrypted;
  }

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    const salt = buffer.slice(0, SALT_LENGTH);
    const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.slice(buffer.length - AUTH_TAG_LENGTH);
    const ciphertext = buffer.slice(SALT_LENGTH + IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);
    const key = deriveKey(encryptionKey, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext.toString('binary'), 'binary', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (err) {
    logger.error('Token decryption failed', {
      operation: 'decrypt',
      error: err instanceof Error ? err.message : String(err),
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    });
    throw err;
  }
};

export const generateEncryptionKey = (): string => randomBytes(32).toString('base64');

export const isEncrypted = (token: string): boolean => {
  if (!token) {
    return false;
  }
  try {
    return Buffer.from(token, 'base64').length >= SALT_LENGTH + IV_LENGTH + 1 + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
};
