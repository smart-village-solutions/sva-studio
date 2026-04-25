import { describe, expect, it } from 'vitest';

import { decryptToken, encryptToken, generateEncryptionKey, isEncrypted } from './crypto.js';

describe('auth-runtime crypto', () => {
  it('encrypts and decrypts tokens with the same key', () => {
    const key = generateEncryptionKey();
    const encrypted = encryptToken('access-token', key);

    expect(encrypted).not.toBe('access-token');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decryptToken(encrypted, key)).toBe('access-token');
  });

  it('keeps tokens unchanged when no encryption key is configured', () => {
    expect(encryptToken('access-token', '')).toBe('access-token');
    expect(decryptToken('access-token', '')).toBe('access-token');
  });
});
