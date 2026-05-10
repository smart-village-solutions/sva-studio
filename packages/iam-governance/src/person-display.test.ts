import { afterEach, describe, expect, it, vi } from 'vitest';

import { revealGovernanceField, resolveGovernancePersonDisplayName } from './person-display.js';

describe('person-display', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns plain values unchanged and hides missing inputs', () => {
    expect(revealGovernanceField(undefined, 'aad')).toBeUndefined();
    expect(revealGovernanceField(null, 'aad')).toBeUndefined();
    expect(revealGovernanceField('visible', 'aad')).toBe('visible');
  });

  it('returns undefined when encrypted fields cannot be decrypted', () => {
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', '');
    vi.stubEnv('IAM_PII_KEYRING_JSON', '');

    expect(revealGovernanceField('enc:v1:payload', 'aad')).toBeUndefined();
  });

  it('prefers the decrypted display name, then the full name, then the subject fallback', () => {
    expect(
      resolveGovernancePersonDisplayName({
        decryptedDisplayName: 'Anja Admin',
        firstName: 'Ignored',
        lastName: 'User',
        keycloakSubject: 'kc-1',
      })
    ).toBe('Anja Admin');

    expect(
      resolveGovernancePersonDisplayName({
        decryptedDisplayName: '  ',
        firstName: 'Anja',
        lastName: 'Admin',
        keycloakSubject: 'kc-1',
      })
    ).toBe('Anja Admin');

    expect(
      resolveGovernancePersonDisplayName({
        firstName: '  ',
        lastName: undefined,
        keycloakSubject: 'kc-1',
      })
    ).toBe('kc-1');
  });
});
