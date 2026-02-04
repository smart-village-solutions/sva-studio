import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Token encryption helper using AES-256-GCM
 * Provides secure at-rest encryption for sensitive tokens in Redis
 */

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive encryption key from password using scrypt
 */
const deriveKey = (password: string, salt: Buffer): Buffer => {
  return scryptSync(password, salt, 32); // 32 bytes for AES-256
};

/**
 * Encrypt sensitive data (tokens) with AES-256-GCM
 * Returns: salt(16) + iv(12) + ciphertext + authTag(16) (base64 encoded)
 */
export const encryptToken = (token: string, encryptionKey: string): string => {
  if (!token) return token;
  if (!encryptionKey) {
    console.warn('[CRYPTO] No encryption key provided, storing token unencrypted');
    return token;
  }

  try {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = deriveKey(encryptionKey, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(token, 'utf8', 'binary');
    ciphertext += cipher.final('binary');

    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + ciphertext + authTag
    const encrypted = Buffer.concat([
      salt,
      iv,
      Buffer.from(ciphertext, 'binary'),
      authTag,
    ]);

    return encrypted.toString('base64');
  } catch (err) {
    console.error('[CRYPTO] Encryption failed:', err);
    throw err;
  }
};

/**
 * Decrypt AES-256-GCM encrypted data
 * Expects: salt(16) + iv(12) + ciphertext + authTag(16) (base64 encoded)
 */
export const decryptToken = (encrypted: string, encryptionKey: string): string => {
  if (!encrypted) return encrypted;
  if (!encryptionKey) {
    console.warn('[CRYPTO] No encryption key provided, treating as unencrypted');
    return encrypted;
  }

  try {
    const buffer = Buffer.from(encrypted, 'base64');

    // Extract components
    const salt = buffer.slice(0, SALT_LENGTH);
    const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.slice(buffer.length - AUTH_TAG_LENGTH);
    const ciphertext = buffer.slice(SALT_LENGTH + IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

    // Derive key
    const key = deriveKey(encryptionKey, salt);

    // Decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext.toString('binary'), 'binary', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (err) {
    console.error('[CRYPTO] Decryption failed:', err);
    throw err;
  }
};

/**
 * Generate a secure random encryption key (base64 encoded)
 * Use this to initialize ENCRYPTION_KEY environment variable
 */
export const generateEncryptionKey = (): string => {
  return randomBytes(32).toString('base64');
};

/**
 * Check if token appears to be encrypted (base64 with sufficient length)
 */
export const isEncrypted = (token: string): boolean => {
  if (!token) return false;
  try {
    // Encrypted tokens are base64 and have minimum length (salt + iv + data + tag)
    const buffer = Buffer.from(token, 'base64');
    return buffer.length >= SALT_LENGTH + IV_LENGTH + 1 + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
};
