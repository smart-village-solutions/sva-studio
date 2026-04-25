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

  it('does not classify long arbitrary base64 values as encrypted', () => {
    const arbitraryBase64 = Buffer.from('this-is-a-long-but-unversioned-token-payload').toString('base64');

    expect(isEncrypted(arbitraryBase64)).toBe(false);
  });

  it('decrypts legacy payloads without the version header', () => {
    const key = generateEncryptionKey();
    const encrypted = encryptToken('access-token', key);
    const withoutHeader = Buffer.from(encrypted, 'base64').subarray(4).toString('base64');

    expect(isEncrypted(withoutHeader)).toBe(false);
    expect(decryptToken(withoutHeader, key)).toBe('access-token');
  });
});
