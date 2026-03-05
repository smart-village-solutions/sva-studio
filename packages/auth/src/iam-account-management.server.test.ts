import { describe, expect, it } from 'vitest';

import { resolveUserDisplayName } from './iam-account-management.server';

describe('resolveUserDisplayName', () => {
  it('prefers explicit display name when present', () => {
    expect(
      resolveUserDisplayName({
        decryptedDisplayName: 'Anzeige Name',
        firstName: 'Max',
        lastName: 'Mustermann',
        keycloakSubject: 'kc:123',
      })
    ).toBe('Anzeige Name');
  });

  it('falls back to first and last name when display name is missing', () => {
    expect(
      resolveUserDisplayName({
        decryptedDisplayName: null,
        firstName: 'Max',
        lastName: 'Mustermann',
        keycloakSubject: 'kc:123',
      })
    ).toBe('Max Mustermann');
  });

  it('falls back to keycloak subject when no name is available', () => {
    expect(
      resolveUserDisplayName({
        decryptedDisplayName: '',
        firstName: ' ',
        lastName: undefined,
        keycloakSubject: 'kc:123',
      })
    ).toBe('kc:123');
  });
});
