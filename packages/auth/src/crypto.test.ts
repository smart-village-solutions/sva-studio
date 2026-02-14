import { describe, it, expect } from 'vitest';
import {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
  isEncrypted,
} from './crypto.server';

describe('Token Encryption (AES-256-GCM)', () => {
  const testKey = generateEncryptionKey();

  describe('generateEncryptionKey', () => {
    it('should generate a valid base64 encryption key', () => {
      const key = generateEncryptionKey();
      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThan(0);

      // Should be valid base64
      expect(() => Buffer.from(key, 'base64')).not.toThrow();

      // Should be 32 bytes (256 bits) when decoded
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encryptToken & decryptToken', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const originalToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

      const encrypted = encryptToken(originalToken, testKey);
      expect(encrypted).not.toBe(originalToken);

      const decrypted = decryptToken(encrypted, testKey);
      expect(decrypted).toBe(originalToken);
    });

    it('should handle empty tokens', () => {
      const encrypted = encryptToken('', testKey);
      expect(encrypted).toBe('');

      const decrypted = decryptToken('', testKey);
      expect(decrypted).toBe('');
    });

    it('should fail to decrypt with wrong key', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token, testKey);
      const wrongKey = generateEncryptionKey();

      expect(() => decryptToken(encrypted, wrongKey)).toThrow();
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const token = 'same-token';
      const encrypted1 = encryptToken(token, testKey);
      const encrypted2 = encryptToken(token, testKey);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same plaintext
      expect(decryptToken(encrypted1, testKey)).toBe(token);
      expect(decryptToken(encrypted2, testKey)).toBe(token);
    });

    it('should handle special characters and unicode', () => {
      const token = 'token-with-üñíçödé-and-emoji-🔐';
      const encrypted = encryptToken(token, testKey);
      const decrypted = decryptToken(encrypted, testKey);
      expect(decrypted).toBe(token);
    });

    it('should handle very long tokens', () => {
      const longToken = 'x'.repeat(10000);
      const encrypted = encryptToken(longToken, testKey);
      const decrypted = decryptToken(encrypted, testKey);
      expect(decrypted).toBe(longToken);
    });

    it('should handle missing encryption key gracefully', () => {
      const token = 'test-token';

      // Should warn and return unencrypted
      const result = encryptToken(token, '');
      expect(result).toBe(token);

      const result2 = decryptToken(token, '');
      expect(result2).toBe(token);
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted tokens', () => {
      const token = 'test-access-token';
      const encrypted = encryptToken(token, testKey);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should not detect unencrypted tokens', () => {
      const token = 'plain-text-token';
      expect(isEncrypted(token)).toBe(false);
    });

    it('should not detect empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should not detect random base64', () => {
      const randomBase64 = Buffer.from('short').toString('base64');
      expect(isEncrypted(randomBase64)).toBe(false);
    });
  });

  describe('Token encryption use cases', () => {
    it('should encrypt access tokens for session storage', () => {
      const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJpc3MiOiJodHRwczovL2tleWNsb2FrLnNtYXJ0LXZpbGxhZ2UuYXBwL3JlYWxtcyJ9.signature';

      const encrypted = encryptToken(accessToken, testKey);
      const decrypted = decryptToken(encrypted, testKey);

      expect(decrypted).toBe(accessToken);
      console.log('[CRYPTO] ✓ Access token encrypted successfully');
    });

    it('should encrypt refresh tokens for session storage', () => {
      const refreshToken = 'refresh-token-value-from-keycloak';

      const encrypted = encryptToken(refreshToken, testKey);
      const decrypted = decryptToken(encrypted, testKey);

      expect(decrypted).toBe(refreshToken);
      console.log('[CRYPTO] ✓ Refresh token encrypted successfully');
    });

    it('should encrypt ID tokens for session storage', () => {
      const idToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2tleWNsb2FrIiwic3ViIjoiY3VzdG9tZXItaWQiLCJhdWQiOiJzdmEtc3R1ZGlvIn0.sig';

      const encrypted = encryptToken(idToken, testKey);
      const decrypted = decryptToken(encrypted, testKey);

      expect(decrypted).toBe(idToken);
      console.log('[CRYPTO] ✓ ID token encrypted successfully');
    });
  });
});
