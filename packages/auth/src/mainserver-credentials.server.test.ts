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
  it('returns credentials from keycloak attributes', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          sva_mainserver_api_key: ['key-1'],
          sva_mainserver_api_secret: ['secret-1'],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'key-1',
      apiSecret: 'secret-1',
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
          sva_mainserver_api_key: ['key-only'],
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
          sva_mainserver_api_key: ['  ', ' key-trimmed  '],
          sva_mainserver_api_secret: ['   secret-trimmed   '],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.server');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'key-trimmed',
      apiSecret: 'secret-trimmed',
    });
  });
});
