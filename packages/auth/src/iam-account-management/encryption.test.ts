import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

describe('iam-account-management encryption', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('returns undefined for encrypted reads when the keyring env is invalid json', async () => {
    process.env = {
      ...originalEnv,
      IAM_PII_ACTIVE_KEY_ID: 'k1',
      IAM_PII_KEYRING_JSON: '{broken-json',
    };

    const { revealField: readField } = await import('./encryption.js');

    expect(readField('enc:v1:k1:iv:tag:ciphertext', 'iam.accounts.email:test-user')).toBeUndefined();
  });

  it('keeps plaintext reads unchanged even when the keyring env is invalid json', async () => {
    process.env = {
      ...originalEnv,
      IAM_PII_ACTIVE_KEY_ID: 'k1',
      IAM_PII_KEYRING_JSON: '{broken-json',
    };

    const { revealField: readField } = await import('./encryption.js');

    expect(readField('plain@example.com', 'iam.accounts.email:test-user')).toBe('plain@example.com');
  });
});
