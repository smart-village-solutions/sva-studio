import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptFieldValue,
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
  type FieldEncryptionKeyring,
} from './field-encryption';

const makeBase64Key = () => randomBytes(32).toString('base64');

const createKeyring = (): { config: FieldEncryptionConfig; keyring: FieldEncryptionKeyring } => {
  const keyA = makeBase64Key();
  const keyB = makeBase64Key();
  const keyring: FieldEncryptionKeyring = { 'key-a': keyA, 'key-b': keyB };
  return {
    config: { activeKeyId: 'key-a', keyring },
    keyring,
  };
};

describe('field-encryption', () => {
  it('encrypts and decrypts plaintext correctly', () => {
    const { config, keyring } = createKeyring();
    const plaintext = 'Vertrauliche Daten';

    const encrypted = encryptFieldValue(plaintext, config);
    const decrypted = decryptFieldValue(encrypted, keyring);

    expect(decrypted).toBe(plaintext);
  });

  it('throws for missing key without leaking key-id in message', () => {
    const keyring: FieldEncryptionKeyring = { 'key-a': makeBase64Key() };
    const config: FieldEncryptionConfig = { activeKeyId: 'missing-id', keyring };

    expect(() => encryptFieldValue('test', config)).toThrow('not configured');
    expect(() => encryptFieldValue('test', config)).not.toThrow('missing-id');

    try {
      encryptFieldValue('test', config);
    } catch (error) {
      const err = error as Error & { context?: Record<string, string> };
      expect(err.context?.keyId).toBe('missing-id');
    }
  });

  it('throws for active env key mismatch without leaking key-id in message', () => {
    expect(() =>
      parseFieldEncryptionConfigFromEnv({
        IAM_PII_ACTIVE_KEY_ID: 'missing',
        IAM_PII_KEYRING_JSON: JSON.stringify({ other: makeBase64Key() }),
      })
    ).toThrow('not present in keyring');

    expect(() =>
      parseFieldEncryptionConfigFromEnv({
        IAM_PII_ACTIVE_KEY_ID: 'missing',
        IAM_PII_KEYRING_JSON: JSON.stringify({ other: makeBase64Key() }),
      })
    ).not.toThrow('missing');

    try {
      parseFieldEncryptionConfigFromEnv({
        IAM_PII_ACTIVE_KEY_ID: 'missing',
        IAM_PII_KEYRING_JSON: JSON.stringify({ other: makeBase64Key() }),
      });
    } catch (error) {
      const err = error as Error & { context?: Record<string, string> };
      expect(err.context?.activeKeyId).toBe('missing');
    }
  });
});
