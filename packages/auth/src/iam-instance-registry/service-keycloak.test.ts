import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  revealField: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn((value: string) => `enc:${value}`),
  revealField: (ciphertext: string | null | undefined, aad: string) => state.revealField(ciphertext, aad),
}));

describe('iam-instance-registry service-keycloak helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.revealField.mockReset();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
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

  it('resolves keycloak status from the latest worker snapshot', async () => {
    const { createGetKeycloakStatusHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
      }),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          instanceId: 'bb-guben',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'ok',
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'snapshot',
              status: 'done',
              summary: 'saved',
              details: {
                status: { realmExists: true, clientExists: true },
              },
            },
          ],
        },
      ]),
    };

    const getStatus = createGetKeycloakStatusHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getStatus('bb-guben')).resolves.toEqual({ realmExists: true, clientExists: true });
    expect(state.logger.info).toHaveBeenCalledWith(
      'keycloak_status_check_completed',
      expect.objectContaining({ instance_id: 'bb-guben' })
    );
  });

  it('builds a local warning preflight until the worker has produced a snapshot', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createGetKeycloakPreflightHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const getPreflight = createGetKeycloakPreflightHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getPreflight('bb-guben')).resolves.toEqual(
      expect.objectContaining({
        overallStatus: 'warning',
        checks: expect.arrayContaining([
          expect.objectContaining({
            checkKey: 'keycloak_admin_access',
            status: 'warning',
          }),
        ]),
      })
    );
  });

  it('treats a missing tenant secret for new realms as generated follow-up state', async () => {
    state.revealField.mockReturnValue(undefined);
    const { createGetKeycloakPreflightHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'new',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: undefined,
        authClientSecretConfigured: false,
        tenantAdminBootstrap: undefined,
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const getPreflight = createGetKeycloakPreflightHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getPreflight('bb-guben')).resolves.toEqual(
      expect.objectContaining({
        checks: expect.arrayContaining([
          expect.objectContaining({
            checkKey: 'tenant_secret',
            status: 'warning',
            summary: 'Das Tenant-Client-Secret wird beim Anlegen des neuen Realm automatisch erzeugt und danach gespeichert.',
            details: expect.objectContaining({
              generatedDuringProvisioning: true,
            }),
          }),
        ]),
      })
    );
  });

  it('reconcile enqueues a provisioning run and returns no immediate status snapshot', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createReconcileKeycloakHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        created: true,
        run: { id: 'run-1' },
      }),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-1',
        overallStatus: 'planned',
      }),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const reconcile = createReconcileKeycloakHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(
      reconcile({
        instanceId: 'bb-guben',
        idempotencyKey: 'idem-1',
        actorId: 'actor-1',
        requestId: 'req-1',
        rotateClientSecret: true,
      })
    ).resolves.toBeNull();
    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'bb-guben',
        overallStatus: 'planned',
        intent: 'rotate_client_secret',
      })
    );
  });

  it('loads the latest preflight snapshot from the worker run', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createGetKeycloakPreflightHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          instanceId: 'bb-guben',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'ok',
          steps: [
            {
              stepKey: 'worker_preflight_snapshot',
              title: 'Vorbedingungen prüfen',
              status: 'done',
              summary: 'ok',
              details: {
                preflight: {
                  overallStatus: 'ready',
                  checkedAt: '2026-01-01T00:00:00.000Z',
                  checks: [],
                },
              },
            },
          ],
        },
      ]),
    };

    const getPreflight = createGetKeycloakPreflightHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getPreflight('bb-guben')).resolves.toEqual(
      expect.objectContaining({
        overallStatus: 'ready',
      })
    );
  });

  it('returns null preflight when the instance cannot be loaded', async () => {
    const { createGetKeycloakPreflightHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const getPreflight = createGetKeycloakPreflightHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(getPreflight('missing')).resolves.toBeNull();
  });

  it('returns null plan when the instance cannot be loaded', async () => {
    const { createPlanKeycloakProvisioningHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const plan = createPlanKeycloakProvisioningHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(plan('missing')).resolves.toBeNull();
  });

  it('returns a persisted worker plan snapshot when available', async () => {
    state.revealField.mockReturnValue('tenant-secret-value');
    const { createPlanKeycloakProvisioningHandler } = await import('./service-keycloak.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:value'),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([
        {
          id: 'run-2',
          instanceId: 'bb-guben',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'ok',
          steps: [
            {
              stepKey: 'worker_plan_snapshot',
              title: 'Soll-Ist-Abgleich planen',
              status: 'done',
              summary: 'ok',
              details: {
                plan: {
                  overallStatus: 'ready',
                  checkedAt: '2026-01-01T00:00:00.000Z',
                  driftSummary: 'snapshot',
                  steps: [],
                },
              },
            },
          ],
        },
      ]),
    };

    const plan = createPlanKeycloakProvisioningHandler({
      repository: repository as never,
      invalidateHost: vi.fn(),
    });

    await expect(plan('bb-guben')).resolves.toEqual(
      expect.objectContaining({
        overallStatus: 'ready',
        driftSummary: 'snapshot',
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
