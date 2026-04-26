import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  decryptFieldValue: vi.fn(),
  encryptFieldValue: vi.fn(),
  parseFieldEncryptionConfigFromEnv: vi.fn(),
}));

vi.mock('@sva/core/security', () => ({
  decryptFieldValue: mocks.decryptFieldValue,
  encryptFieldValue: mocks.encryptFieldValue,
  parseFieldEncryptionConfigFromEnv: mocks.parseFieldEncryptionConfigFromEnv,
}));

import { getEncryptionConfig, protectField, revealField } from './encryption.js';

describe('iam admin encryption helpers', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('caches parsed encryption config by key signature', () => {
    const config = { activeKeyId: 'key-a', keyring: { 'key-a': 'secret' } };
    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValue(config);
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', 'key-a');
    vi.stubEnv('IAM_PII_KEYRING_JSON', '{"key-a":"secret"}');

    expect(getEncryptionConfig()).toBe(config);
    expect(getEncryptionConfig()).toBe(config);

    expect(mocks.parseFieldEncryptionConfigFromEnv).toHaveBeenCalledTimes(1);
  });

  it('returns null for empty protected values and plaintext fallback outside production', () => {
    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValue(null);
    vi.stubEnv('NODE_ENV', 'development');

    expect(protectField(undefined, 'aad')).toBeNull();
    expect(protectField('', 'aad')).toBeNull();
    expect(protectField('clear text', 'aad')).toBe('clear text');
  });

  it('requires encryption when plaintext fallback is disabled', () => {
    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValue(null);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('IAM_PII_ALLOW_PLAINTEXT_FALLBACK', 'false');

    expect(() => protectField('secret', 'aad')).toThrow('pii_encryption_required');
  });

  it('encrypts and reveals encrypted values with configured key material', () => {
    const config = { activeKeyId: 'key-a', keyring: { 'key-a': 'secret' } };
    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValue(config);
    mocks.encryptFieldValue.mockReturnValue('enc:v1:payload');
    mocks.decryptFieldValue.mockReturnValue('clear text');
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', 'key-a');
    vi.stubEnv('IAM_PII_KEYRING_JSON', '{"key-a":"secret"}');

    expect(protectField('clear text', 'aad')).toBe('enc:v1:payload');
    expect(revealField('enc:v1:payload', 'aad')).toBe('clear text');
    expect(revealField('plain', 'aad')).toBe('plain');
    expect(revealField(null, 'aad')).toBeUndefined();
    expect(mocks.encryptFieldValue).toHaveBeenCalledWith('clear text', config, 'aad');
    expect(mocks.decryptFieldValue).toHaveBeenCalledWith('enc:v1:payload', config.keyring, 'aad');
  });

  it('hides encrypted values when config parsing or decryption fails', () => {
    mocks.parseFieldEncryptionConfigFromEnv.mockImplementation(() => {
      throw new Error('invalid keyring');
    });
    expect(revealField('enc:v1:payload', 'aad')).toBeUndefined();

    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValue({ activeKeyId: 'key-a', keyring: {} });
    mocks.decryptFieldValue.mockImplementation(() => {
      throw new Error('decrypt failed');
    });
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', 'key-a');

    expect(revealField('enc:v1:payload', 'aad')).toBeUndefined();
  });
});
