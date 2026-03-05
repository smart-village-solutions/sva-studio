import { describe, expect, it } from 'vitest';

import { isTrustedRequestOrigin, resolveUserDisplayName } from './iam-account-management.server';

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

describe('isTrustedRequestOrigin', () => {
  it('accepts same-origin origin header', () => {
    const request = new Request('https://studio.example.com/api/v1/iam/users', {
      headers: {
        origin: 'https://studio.example.com',
      },
    });

    expect(isTrustedRequestOrigin(request)).toBe(true);
  });

  it('accepts configured trusted cross-origin origin header', () => {
    const request = new Request('https://api.example.com/api/v1/iam/users', {
      headers: {
        origin: 'https://admin.example.com',
      },
    });

    expect(isTrustedRequestOrigin(request, 'https://admin.example.com')).toBe(true);
  });

  it('accepts trusted referer origin when origin header is absent', () => {
    const request = new Request('https://api.example.com/api/v1/iam/users', {
      headers: {
        referer: 'https://admin.example.com/users/1',
      },
    });

    expect(isTrustedRequestOrigin(request, 'https://admin.example.com')).toBe(true);
  });

  it('rejects unknown origin header', () => {
    const request = new Request('https://api.example.com/api/v1/iam/users', {
      headers: {
        origin: 'https://evil.example.com',
      },
    });

    expect(isTrustedRequestOrigin(request, 'https://admin.example.com')).toBe(false);
  });

  it('rejects requests without origin and referer', () => {
    const request = new Request('https://api.example.com/api/v1/iam/users');

    expect(isTrustedRequestOrigin(request, 'https://admin.example.com')).toBe(false);
  });
});
