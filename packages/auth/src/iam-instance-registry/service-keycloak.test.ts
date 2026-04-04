import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  revealField: vi.fn(),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  revealField: (ciphertext: string | null | undefined, aad: string) => state.revealField(ciphertext, aad),
}));

describe('iam-instance-registry service-keycloak helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.revealField.mockReset();
  });

  it('decrypts repository secrets with the instance-specific aad', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { decryptAuthClientSecret } = await import('./service-keycloak.js');

    const result = decryptAuthClientSecret('bb-guben', 'enc:value');

    expect(result).toBe('tenant-secret-value');
    expect(state.revealField).toHaveBeenCalledWith('enc:value', 'iam.instances.auth_client_secret:bb-guben');
  });

  it('loads decrypted secrets from the repository', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { loadRepositoryAuthClientSecret } = await import('./service-keycloak.js');
    const repository = {
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
    };

    await expect(loadRepositoryAuthClientSecret(repository as never, 'bb-guben')).resolves.toBe('tenant-secret-value');
  });

  it('returns null keycloak status when the instance or dependency is missing', async () => {
    const { createGetKeycloakStatusHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
    };

    const getStatus = createGetKeycloakStatusHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getStatus('bb-guben')).resolves.toBeNull();
  });

  it('resolves keycloak status with decrypted tenant secret', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createGetKeycloakStatusHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
    };
    const getKeycloakStatus = vi.fn().mockResolvedValue({ realmExists: true });

    const getStatus = createGetKeycloakStatusHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
      getKeycloakStatus,
    });

    await expect(getStatus('bb-guben')).resolves.toEqual({ realmExists: true });
    expect(getKeycloakStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'bb-guben',
        authClientSecret: 'tenant-secret-value',
      })
    );
  });

  it('throws when reconcile requires a missing tenant secret', async () => {
    state.revealField.mockReturnValue(undefined);
    const { createReconcileKeycloakHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
    };

    const reconcile = createReconcileKeycloakHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
      provisionInstanceAuth: vi.fn(),
      getKeycloakStatus: vi.fn(),
    });

    await expect(
      reconcile({
        instanceId: 'bb-guben',
        actorId: 'actor-1',
        requestId: 'req-1',
      })
    ).rejects.toThrow('tenant_auth_client_secret_missing');
  });

  it('reconciles the tenant auth artifacts and returns refreshed status', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createReconcileKeycloakHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
    };
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const getKeycloakStatus = vi.fn().mockResolvedValue({ secretAligned: true });

    const reconcile = createReconcileKeycloakHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
      provisionInstanceAuth,
      getKeycloakStatus,
    });

    await expect(
      reconcile({
        instanceId: 'bb-guben',
        actorId: 'actor-1',
        requestId: 'req-1',
        tenantAdminTemporaryPassword: 'test-temp-password',
        rotateClientSecret: true,
      })
    ).resolves.toEqual({ secretAligned: true });

    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'bb-guben',
        authClientSecret: 'tenant-secret-value',
        rotateClientSecret: true,
      })
    );
  });

  it('returns an invalid unknown_host classification when no runtime instance matches', async () => {
    const { createRuntimeResolver } = await import('./service-keycloak.js');
    const resolveRuntimeInstance = createRuntimeResolver({
      resolveHostname: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(resolveRuntimeInstance('Missing.Example.Org:443')).resolves.toEqual({
      hostClassification: {
        kind: 'invalid',
        normalizedHost: 'missing.example.org',
        reason: 'unknown_host',
      },
      instance: null,
    });
  });
});
