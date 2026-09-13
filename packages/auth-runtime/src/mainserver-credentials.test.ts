import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveIdentityProvider: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) =>
    execute()
  ),
}));

vi.mock('./keycloak-user-attributes.js', () => ({
  resolveIdentityProvider: state.resolveIdentityProvider,
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  trackKeycloakCall: state.trackKeycloakCall,
}));

describe('readSvaMainserverCredentials', () => {
  it('derives a secret-safe readiness result for missing, partial and complete pairs', async () => {
    const { resolveMainserverCredentialReadiness } = await import('./mainserver-credentials.js');

    expect(resolveMainserverCredentialReadiness(null)).toEqual({ status: 'unavailable' });
    expect(resolveMainserverCredentialReadiness({})).toEqual({
      status: 'missing',
      missingAttributeNames: ['mainserverUserApplicationId', 'mainserverUserApplicationSecret'],
    });
    expect(
      resolveMainserverCredentialReadiness({ mainserverUserApplicationId: ['app-id'] })
    ).toEqual({
      status: 'partial',
      missingAttributeNames: ['mainserverUserApplicationSecret'],
    });
    expect(
      resolveMainserverCredentialReadiness({ mainserverUserApplicationSecret: ['secret'] })
    ).toEqual({
      status: 'partial',
      missingAttributeNames: ['mainserverUserApplicationId'],
    });
    expect(
      resolveMainserverCredentialReadiness({
        mainserverUserApplicationId: ['app-id'],
        mainserverUserApplicationSecret: ['secret'],
      })
    ).toEqual({
      status: 'ready',
      attributeSource: 'canonical',
      credentials: { apiKey: 'app-id', apiSecret: 'secret' },
    });
    expect(
      resolveMainserverCredentialReadiness({
        mainserverUserApplicationId: ['canonical-id'],
        sva_mainserver_api_secret: ['legacy-secret'],
      })
    ).toEqual({
      status: 'partial',
      missingAttributeNames: ['mainserverUserApplicationSecret'],
    });
    expect(
      resolveMainserverCredentialReadiness({
        mainserverUserApplicationSecret: ['canonical-secret'],
        sva_mainserver_api_key: ['legacy-id'],
      })
    ).toEqual({
      status: 'partial',
      missingAttributeNames: ['mainserverUserApplicationId'],
    });
    expect(
      resolveMainserverCredentialReadiness({
        mainserverUserApplicationId: ['incomplete-canonical-id'],
        sva_mainserver_api_key: ['legacy-id'],
        sva_mainserver_api_secret: ['legacy-secret'],
      })
    ).toEqual({
      status: 'ready',
      attributeSource: 'legacy',
      credentials: { apiKey: 'legacy-id', apiSecret: 'legacy-secret' },
    });
  });

  it('verifies a persisted credential version without returning credential values', async () => {
    const { createMainserverCredentialFingerprint, verifyMainserverCredentialReadback } =
      await import('./mainserver-credentials.js');
    const expectedFingerprint = createMainserverCredentialFingerprint({
      instanceId: 'instance-1',
      source: 'user',
      principalId: 'subject-1',
      credentials: { apiKey: 'app-id', apiSecret: 'secret' },
    });

    expect(
      verifyMainserverCredentialReadback({
        attributes: {
          mainserverUserApplicationId: ['app-id'],
          mainserverUserApplicationSecret: ['secret'],
        },
        expectedFingerprint,
        instanceId: 'instance-1',
        principalId: 'subject-1',
      })
    ).toEqual({ status: 'ready', credentialFingerprint: expectedFingerprint });

    expect(
      verifyMainserverCredentialReadback({
        attributes: {
          mainserverUserApplicationId: ['other-app-id'],
          mainserverUserApplicationSecret: ['secret'],
        },
        expectedFingerprint,
        instanceId: 'instance-1',
        principalId: 'subject-1',
      })
    ).toEqual({ status: 'stale' });

    expect(
      verifyMainserverCredentialReadback({
        attributes: {
          sva_mainserver_api_key: ['app-id'],
          sva_mainserver_api_secret: ['secret'],
        },
        expectedFingerprint,
        instanceId: 'instance-1',
        principalId: 'subject-1',
      })
    ).toEqual({ status: 'stale' });
  });

  it('classifies complete, partial, missing and unavailable credential states', async () => {
    const { resolveMainserverCredentialStatus } = await import('./mainserver-credentials.js');

    expect(
      resolveMainserverCredentialStatus({
        mainserverUserApplicationId: ['app-id'],
        mainserverUserApplicationSecret: ['secret'],
      })
    ).toBe('complete');
    expect(resolveMainserverCredentialStatus({ mainserverUserApplicationSecret: ['secret'] })).toBe(
      'missing_application_id'
    );
    expect(resolveMainserverCredentialStatus({ mainserverUserApplicationId: ['app-id'] })).toBe(
      'missing_application_secret'
    );
    expect(resolveMainserverCredentialStatus({})).toBe('missing_both');
    expect(resolveMainserverCredentialStatus(undefined)).toBe('unknown');
    expect(resolveMainserverCredentialStatus(null)).toBe('unknown');
    expect(
      resolveMainserverCredentialStatus({
        mainserverUserApplicationId: ['canonical-id'],
        sva_mainserver_api_secret: ['legacy-secret'],
      })
    ).toBe('missing_application_secret');
    expect(
      resolveMainserverCredentialStatus({
        mainserverUserApplicationSecret: ['canonical-secret'],
        sva_mainserver_api_key: ['legacy-id'],
      })
    ).toBe('missing_application_id');
  });

  it('projects mixed canonical and legacy pairs as incomplete for admin and API responses', async () => {
    const { resolveMainserverCredentialState } = await import('./mainserver-credentials.js');

    expect(
      resolveMainserverCredentialState({
        mainserverUserApplicationId: ['canonical-id'],
        sva_mainserver_api_secret: ['legacy-secret'],
      })
    ).toEqual({
      mainserverUserApplicationId: 'canonical-id',
      mainserverUserApplicationSecretSet: false,
    });
    expect(
      resolveMainserverCredentialState({
        mainserverUserApplicationSecret: ['canonical-secret'],
        sva_mainserver_api_key: ['legacy-id'],
      })
    ).toEqual({ mainserverUserApplicationSecretSet: true });
  });

  it('returns credentials from the current keycloak attributes', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockResolvedValue({
          mainserverUserApplicationId: ['key-1'],
          mainserverUserApplicationSecret: ['secret-1'],
        }),
      },
    });

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.js');

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

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.js');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'legacy-key',
      apiSecret: 'legacy-secret',
    });
  });

  it('returns null when the identity provider is unavailable', async () => {
    state.resolveIdentityProvider.mockReturnValue(null);

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.js');

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

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.js');

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

    const { readSvaMainserverCredentials } = await import('./mainserver-credentials.js');

    await expect(readSvaMainserverCredentials('subject-1')).resolves.toEqual({
      apiKey: 'key-trimmed',
      apiSecret: 'secret-trimmed',
    });
  });

  it('returns detailed status when identity provider is unavailable', async () => {
    state.resolveIdentityProvider.mockReturnValue(null);

    const { readSvaMainserverCredentialsWithStatus } = await import('./mainserver-credentials.js');

    await expect(readSvaMainserverCredentialsWithStatus('subject-1')).resolves.toEqual({
      status: 'identity_provider_unavailable',
    });
  });

  it('returns unavailable when the configured identity provider read fails', async () => {
    state.resolveIdentityProvider.mockReturnValue({
      provider: {
        getUserAttributes: vi.fn().mockRejectedValue(new Error('keycloak unavailable')),
      },
    });

    const { readSvaMainserverCredentialsWithStatus } = await import('./mainserver-credentials.js');

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

    const { readSvaMainserverCredentialsWithStatus } = await import('./mainserver-credentials.js');

    await expect(readSvaMainserverCredentialsWithStatus('subject-1')).resolves.toEqual({
      status: 'partial_credentials',
      missingAttributeNames: ['mainserverUserApplicationSecret'],
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

    const { readIdentityUserAttributes, resolveMainserverCredentialState } =
      await import('./mainserver-credentials.js');

    const attributes = await readIdentityUserAttributes({ keycloakSubject: 'subject-1' });
    expect(resolveMainserverCredentialState(attributes)).toEqual({
      mainserverUserApplicationId: 'current-id',
      mainserverUserApplicationSecretSet: true,
    });
  });

  it('builds canonical keycloak attributes and preserves legacy secrets on write', async () => {
    const { buildMainserverIdentityAttributes } = await import('./mainserver-credentials.js');

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

  it('treats blank secret updates as not set and preserves the existing secret', async () => {
    const { buildMainserverIdentityAttributes } = await import('./mainserver-credentials.js');

    expect(
      buildMainserverIdentityAttributes({
        existingAttributes: {
          displayName: ['Alice Admin'],
          mainserverUserApplicationId: ['current-id'],
          mainserverUserApplicationSecret: ['current-secret'],
        },
        mainserverUserApplicationSecret: '   ',
      })
    ).toEqual({
      displayName: ['Alice Admin'],
      mainserverUserApplicationId: ['current-id'],
      mainserverUserApplicationSecret: ['current-secret'],
    });
  });
});
