import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveIdentityProvider: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
}));

vi.mock('./iam-account-management/shared', () => ({
  resolveIdentityProvider: state.resolveIdentityProvider,
  trackKeycloakCall: state.trackKeycloakCall,
}));

describe('readSvaMainserverCredentials', () => {
  it('returns credentials from the current keycloak attributes', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['key-1'],
          mainserverUserApplicationSecret: ['secret-1'],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'key-1',
      apiSecret: 'secret-1',
    });
  });

  it('falls back to the legacy keycloak attributes for existing users', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          sva_mainserver_api_key: ['legacy-key'],
          sva_mainserver_api_secret: ['legacy-secret'],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'legacy-key',
      apiSecret: 'legacy-secret',
    });
  });

  it('returns null when the identity provider is unavailable', async () => {
    state.resolveIdentityProvider.mockReturnValue(null);

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toBeNull();
  });

  it('returns null when required attributes are missing', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['key-only'],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toBeNull();
  });

  it('trims credential values and ignores blank entries', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['  ', ' key-trimmed  '],
          mainserverUserApplicationSecret: ['   secret-trimmed   '],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'key-trimmed',
      apiSecret: 'secret-trimmed',
    });
  });

  it('returns detailed status when identity provider is unavailable', async () => {
    state.resolveIdentityProvider.mockReturnValue(null);

    const { readSvaMainserverCredentialsWithStatus } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentialsWithStatus('subject-1')).resolves.toEqual({
      status: 'identity_provider_unavailable',
    });
  });

  it('returns detailed status when required attributes are missing', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['key-only'],
        }),
      },
    });

    const { readSvaMainserverCredentialsWithStatus } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentialsWithStatus('subject-1')).resolves.toEqual({
      status: 'missing_credentials',
    });
  });

  it('derives admin-facing credential state without returning the secret', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['current-id'],
          mainserverUserApplicationSecret: ['current-secret'],
        }),
      },
    });

    const { readIdentityUserAttributes, resolveMainserverCredentialState } = await import('./mainserver-credentials.server');

    const attributes = await readIdentityUserAttributes({ keycloakSubject: 'subject-1' });
    expect(resolveMainserverCredentialState(attributes)).toEqual({
      mainserverUserApplicationId: 'current-id',
      mainserverUserApplicationSecretSet: true,
    });
  });

  it('builds canonical keycloak attributes and preserves legacy secrets on write', async () => {
    const { buildMainserverIdentityAttributes } = await import('./mainserver-credentials.server');

    expect(
      buildMainserverIdentityAttributes({
        existingAttributes: {
          displayName: ['Alice Admin'],
          sva_mainserver_api_key: ['legacy-key'],
          sva_mainserver_api_secret: ['legacy-secret'],
        },
        mainserverUserApplicationId: 'updated-id',
      })
    ).toEqual({
      displayName: ['Alice Admin'],
      mainserverUserApplicationId: ['updated-id'],
      mainserverUserApplicationSecret: ['legacy-secret'],
    });
  });
});
