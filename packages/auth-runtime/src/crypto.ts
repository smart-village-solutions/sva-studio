import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createSdkLogger } from '@sva/server-runtime';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const ALGORITHM = 'aes-256-gcm';
const FORMAT_MAGIC = Buffer.from('SVA1', 'ascii');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const LEGACY_MIN_ENCRYPTED_LENGTH = SALT_LENGTH + IV_LENGTH + 1 + AUTH_TAG_LENGTH;
const MIN_ENCRYPTED_LENGTH = FORMAT_MAGIC.length + SALT_LENGTH + IV_LENGTH + 1 + AUTH_TAG_LENGTH;

const deriveKey = (password: string, salt: Buffer): Buffer => scryptSync(password, salt, 32);
const hasFormatMagic = (buffer: Buffer): boolean =>
  buffer.length >= FORMAT_MAGIC.length && buffer.subarray(0, FORMAT_MAGIC.length).equals(FORMAT_MAGIC);

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
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);

    return Buffer.concat([
      FORMAT_MAGIC,
      salt,
      iv,
      ciphertext,
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
    const hasCurrentFormat = hasFormatMagic(buffer);
    if (!hasCurrentFormat && buffer.length < LEGACY_MIN_ENCRYPTED_LENGTH) {
      return encrypted;
    }

    const offset = hasCurrentFormat ? FORMAT_MAGIC.length : 0;
    const salt = buffer.subarray(offset, offset + SALT_LENGTH);
    const iv = buffer.subarray(offset + SALT_LENGTH, offset + SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
    const ciphertext = buffer.subarray(offset + SALT_LENGTH + IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);
    const key = deriveKey(encryptionKey, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    if (!isEncrypted(encrypted)) {
      logger.warn('Token decryption skipped for unrecognized payload format', {
        operation: 'decrypt',
        error_type: err instanceof Error ? err.constructor.name : typeof err,
      });
      return encrypted;
    }

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
    const buffer = Buffer.from(token, 'base64');
    return buffer.length >= MIN_ENCRYPTED_LENGTH && hasFormatMagic(buffer);
  } catch {
    return false;
  }
};
