import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readSvaMainserverCredentialsWithStatus: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./mainserver-credentials.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mainserver-credentials.js')>();

  return {
    ...actual,
    readSvaMainserverCredentialsWithStatus: state.readSvaMainserverCredentialsWithStatus,
  };
});

vi.mock('./iam-account-management/shared-runtime.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

describe('readEffectiveSvaMainserverCredentialsWithStatus', () => {
  let readEffectiveSvaMainserverCredentialsWithStatus: typeof import('./mainserver-effective-credentials.js').readEffectiveSvaMainserverCredentialsWithStatus;

  beforeAll(async () => {
    ({ readEffectiveSvaMainserverCredentialsWithStatus } =
      await import('./mainserver-effective-credentials.js'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses organization credentials for org_only organizations', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_only',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: 'org-secret-1',
            },
          ],
        })),
      })
    );

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      })
    ).resolves.toEqual({
      status: 'ok',
      source: 'organization',
      credentials: {
        apiKey: 'org-app-1',
        apiSecret: 'org-secret-1',
      },
      credentialFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      organizationId: '11111111-1111-1111-8111-111111111111',
    });
    expect(state.readSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
  });

  it('falls back to user credentials for org_or_personal organizations without complete org credentials', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_or_personal',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: null,
            },
          ],
        })),
      })
    );
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: {
        apiKey: 'user-app-1',
        apiSecret: 'user-secret-1',
      },
      credentialFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      })
    ).resolves.toEqual({
      status: 'ok',
      source: 'user',
      credentials: {
        apiKey: 'user-app-1',
        apiSecret: 'user-secret-1',
      },
      credentialFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('returns a deterministic org-scoped error for org_only organizations without complete credentials', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_only',
              mainserver_application_id: null,
              mainserver_application_secret_ciphertext: null,
            },
          ],
        })),
      })
    );

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      })
    ).resolves.toEqual({
      status: 'organization_mainserver_credentials_missing',
      organizationId: '11111111-1111-1111-8111-111111111111',
    });
  });

  it('uses the user path when no active organization is set', async () => {
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: {
        apiKey: 'user-app-1',
        apiSecret: 'user-secret-1',
      },
    });

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toEqual({
      status: 'ok',
      source: 'user',
      credentials: {
        apiKey: 'user-app-1',
        apiSecret: 'user-secret-1',
      },
      credentialFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(state.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('propagates database_unavailable when the org lookup fails', async () => {
    state.withInstanceScopedDb.mockRejectedValue(new Error('db unavailable'));

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      })
    ).resolves.toEqual({
      status: 'database_unavailable',
    });
  });

  it('uses only organization credentials for an explicit organization mutation', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_or_personal',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: 'org-secret-1',
            },
          ],
        })),
      })
    );

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'organization',
      })
    ).resolves.toMatchObject({
      status: 'ok',
      source: 'organization',
      organizationId: '11111111-1111-1111-8111-111111111111',
    });
    expect(state.readSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
  });

  it('uses only user credentials for an explicit user mutation', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_or_personal',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: 'org-secret-1',
            },
          ],
        })),
      })
    );
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: { apiKey: 'user-app-1', apiSecret: 'user-secret-1' },
    });

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'user',
      })
    ).resolves.toMatchObject({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'user-app-1', apiSecret: 'user-secret-1' },
    });
  });

  it('rejects an explicit user mutation for org_only', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_only',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: 'org-secret-1',
            },
          ],
        })),
      })
    );

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'user',
      })
    ).resolves.toEqual({
      status: 'acting_principal_not_allowed',
      actingPrincipalType: 'user',
    });
    expect(state.readSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
  });

  it('does not fall back when explicit organization credentials are incomplete', async () => {
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({
        query: vi.fn(async () => ({
          rows: [
            {
              content_author_policy: 'org_or_personal',
              mainserver_application_id: 'org-app-1',
              mainserver_application_secret_ciphertext: null,
            },
          ],
        })),
      })
    );

    await expect(
      readEffectiveSvaMainserverCredentialsWithStatus({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
        actingPrincipalType: 'organization',
      })
    ).resolves.toEqual({
      status: 'organization_mainserver_credentials_missing',
      organizationId: '11111111-1111-1111-8111-111111111111',
    });
    expect(state.readSvaMainserverCredentialsWithStatus).not.toHaveBeenCalled();
  });

  it('returns a stable fingerprint per credential version and principal context', async () => {
    state.readSvaMainserverCredentialsWithStatus.mockResolvedValue({
      status: 'ok',
      credentials: { apiKey: 'user-app-1', apiSecret: 'user-secret-1' },
    });

    const first = await readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      actingPrincipalType: 'user',
    });
    const second = await readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      actingPrincipalType: 'user',
    });

    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    if (first.status === 'ok' && second.status === 'ok') {
      expect(first.credentialFingerprint).toBe(second.credentialFingerprint);
      expect(first.credentialFingerprint).not.toContain('user-app-1');
      expect(first.credentialFingerprint).not.toContain('user-secret-1');
    }
  });
});
