import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  protectField: vi.fn((value: string) => `enc:${value}`),
  revealField: vi.fn((value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('enc:') ? value.slice(4) : undefined
  ),
  readKeycloakStateViaProvisioner: vi.fn(async () => ({
    keycloakClientSecret: 'rotated-secret',
  })),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: (value: string) => state.protectField(value),
  revealField: (value: string | null | undefined) => state.revealField(value),
}));

vi.mock('./provisioning-auth-state.js', () => ({
  readKeycloakStateViaProvisioner: (...args: unknown[]) => state.readKeycloakStateViaProvisioner(...args),
}));

describe('iam-instance-registry keycloak execution handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when execute cannot load the instance', async () => {
    const { createExecuteKeycloakProvisioningHandler } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
      getAuthClientSecretCiphertext: vi.fn(),
    };

    const handler = createExecuteKeycloakProvisioningHandler({
      repository: repository as never,
    } as never);

    await expect(
      handler({ instanceId: 'missing', actorId: 'admin-1', requestId: 'req-1', intent: 'provision' })
    ).resolves.toBeNull();
  }, 15000);

  it('throws when the tenant secret is missing before a run is enqueued', async () => {
    const { createReconcileKeycloakHandler } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      createKeycloakProvisioningRun: vi.fn(),
      appendKeycloakProvisioningStep: vi.fn(),
      getKeycloakProvisioningRun: vi.fn(),
    };

    const handler = createReconcileKeycloakHandler({
      repository: repository as never,
    } as never);

    await expect(handler({ instanceId: 'demo', actorId: 'admin-1', requestId: 'req-1' })).rejects.toThrow(
      'tenant_auth_client_secret_missing'
    );
    expect(repository.createKeycloakProvisioningRun).not.toHaveBeenCalled();
  });

  it('allows enqueueing a new realm reconcile without a preconfigured tenant secret', async () => {
    const { createReconcileKeycloakHandler } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo-new',
        primaryHostname: 'demo-new.example.org',
        realmMode: 'new',
        authRealm: 'demo-new',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-new-1' }),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-new-1',
        overallStatus: 'planned',
      }),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([]),
    };

    const handler = createReconcileKeycloakHandler({
      repository: repository as never,
    } as never);

    await expect(handler({ instanceId: 'demo-new', actorId: 'admin-1', requestId: 'req-1' })).resolves.toBeNull();
    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo-new',
        intent: 'provision',
      })
    );
  });

  it('enqueues a run and returns the latest status snapshot after reconcile', async () => {
    const { createReconcileKeycloakHandler } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'demo-admin' },
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:secret'),
      createKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-1',
        overallStatus: 'planned',
      }),
      listKeycloakProvisioningRuns: vi.fn().mockResolvedValue([
        {
          id: 'run-0',
          steps: [
            {
              stepKey: 'status_snapshot',
              details: {
                status: {
                  realmExists: true,
                  clientExists: true,
                },
              },
            },
          ],
        },
      ]),
    };

    const handler = createReconcileKeycloakHandler({
      repository: repository as never,
    } as never);

    await expect(
      handler({
        instanceId: 'demo',
        actorId: 'admin-1',
        requestId: 'req-1',
        rotateClientSecret: true,
        tenantAdminTemporaryPassword: 'temp-password',
      })
    ).resolves.toEqual({
      realmExists: true,
      clientExists: true,
    });
    expect(repository.createKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        intent: 'rotate_client_secret',
        overallStatus: 'planned',
      })
    );
    expect(repository.appendKeycloakProvisioningStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        stepKey: 'queued',
      })
    );
  });

  it('persists the rotated Keycloak client secret back into the registry', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'demo-admin' },
        featureFlags: {},
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:registry-secret'),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-1',
        overallStatus: 'succeeded',
      }),
      updateInstance: vi.fn().mockResolvedValue({}),
      setInstanceStatus: vi.fn().mockResolvedValue({ status: 'provisioning' }),
    };

    const deps = {
      repository: repository as never,
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
      getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ready' }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' }),
      getKeycloakStatus: vi.fn().mockResolvedValue({
        realmExists: true,
        clientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: false,
        tenantAdminInstanceIdMatches: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      }),
    } as never;

    await processClaimedKeycloakProvisioningRun(deps, {
      id: 'run-1',
      instanceId: 'demo',
      mode: 'existing',
      intent: 'rotate_client_secret',
      overallStatus: 'planned',
      driftSummary: '',
      requestId: 'req-1',
      actorId: 'actor-1',
      createdAt: '',
      updatedAt: '',
      steps: [{ stepKey: 'queued', details: {} }],
    });

    expect(state.readKeycloakStateViaProvisioner).toHaveBeenCalled();
    expect(repository.updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        authClientSecretCiphertext: 'enc:rotated-secret',
        keepExistingAuthClientSecret: false,
      })
    );
  });

  it('persists a generated tenant secret after provisioning a new realm', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo-new',
        displayName: 'Demo New',
        parentDomain: 'example.org',
        primaryHostname: 'demo-new.example.org',
        realmMode: 'new',
        authRealm: 'demo-new',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
        tenantAdminBootstrap: undefined,
        featureFlags: {},
        status: 'requested',
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-new-2',
        overallStatus: 'succeeded',
      }),
      updateInstance: vi.fn().mockResolvedValue({}),
      setInstanceStatus: vi.fn().mockResolvedValue({ status: 'provisioning' }),
    };

    const deps = {
      repository: repository as never,
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
      getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ready' }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' }),
      getKeycloakStatus: vi.fn().mockResolvedValue({
        realmExists: true,
        clientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: false,
        tenantAdminHasSystemAdmin: false,
        tenantAdminHasInstanceRegistryAdmin: false,
        tenantAdminInstanceIdMatches: false,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      }),
    } as never;

    await processClaimedKeycloakProvisioningRun(deps, {
      id: 'run-new-2',
      instanceId: 'demo-new',
      mode: 'new',
      intent: 'provision',
      overallStatus: 'planned',
      driftSummary: '',
      requestId: 'req-1',
      actorId: 'actor-1',
      createdAt: '',
      updatedAt: '',
      steps: [{ stepKey: 'queued', details: {} }],
    });

    expect(state.readKeycloakStateViaProvisioner).toHaveBeenCalled();
    expect(repository.updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo-new',
        authClientSecretCiphertext: 'enc:rotated-secret',
        keepExistingAuthClientSecret: false,
      })
    );
  });

  it('moves the instance into provisioning after a successful Keycloak run', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'demo-admin' },
        featureFlags: {},
        status: 'requested',
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:registry-secret'),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({
        id: 'run-2',
        overallStatus: 'succeeded',
      }),
      updateInstance: vi.fn().mockResolvedValue({}),
      setInstanceStatus: vi.fn().mockResolvedValue({ status: 'provisioning' }),
    };

    const deps = {
      repository: repository as never,
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
      getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ready' }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' }),
      getKeycloakStatus: vi.fn().mockResolvedValue({
        realmExists: true,
        clientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: false,
        tenantAdminInstanceIdMatches: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      }),
    } as never;

    await processClaimedKeycloakProvisioningRun(deps, {
      id: 'run-2',
      instanceId: 'demo',
      mode: 'existing',
      intent: 'provision',
      overallStatus: 'planned',
      driftSummary: '',
      requestId: 'req-2',
      actorId: 'actor-2',
      createdAt: '',
      updatedAt: '',
      steps: [{ stepKey: 'queued', details: {} }],
    });

    expect(repository.setInstanceStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        status: 'provisioning',
        actorId: 'actor-2',
        requestId: 'req-2',
      })
    );
  });

  it('returns null when no claimed run is provided', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');

    await expect(processClaimedKeycloakProvisioningRun({} as never, null)).resolves.toBeNull();
  });

  it('marks claimed run as failed when worker dependencies are missing', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-missing', overallStatus: 'failed' }),
    };

    const result = await processClaimedKeycloakProvisioningRun(
      {
        repository: repository as never,
      } as never,
      {
        id: 'run-missing',
        instanceId: 'demo',
        mode: 'existing',
        intent: 'provision',
        overallStatus: 'planned',
        driftSummary: '',
        requestId: 'req-3',
        actorId: 'actor-3',
        createdAt: '',
        updatedAt: '',
        steps: [{ stepKey: 'queued', details: {} }],
      }
    );

    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalled();
    expect(result).toEqual({ id: 'run-missing', overallStatus: 'failed' });
  });

  it('returns latest run when claimed instance cannot be loaded anymore', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue(null),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-not-found', overallStatus: 'failed' }),
    };

    const deps = {
      repository: repository as never,
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
      getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ready' }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' }),
      getKeycloakStatus: vi.fn().mockResolvedValue({ realmExists: false }),
    } as never;

    const result = await processClaimedKeycloakProvisioningRun(deps, {
      id: 'run-not-found',
      instanceId: 'demo',
      mode: 'existing',
      intent: 'provision',
      overallStatus: 'running',
      driftSummary: '',
      requestId: 'req-4',
      actorId: 'actor-4',
      createdAt: '',
      updatedAt: '',
      steps: [{ stepKey: 'queued', details: {} }],
    });

    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalled();
    expect(result).toEqual({ id: 'run-not-found', overallStatus: 'failed' });
  });

  it('returns failed run when worker preflight is blocked', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getInstanceById: vi.fn().mockResolvedValue({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminBootstrap: { username: 'demo-admin' },
        featureFlags: {},
      }),
      getAuthClientSecretCiphertext: vi.fn().mockResolvedValue('enc:secret'),
      appendKeycloakProvisioningStep: vi.fn().mockResolvedValue(undefined),
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-blocked', overallStatus: 'failed' }),
      setInstanceStatus: vi.fn().mockResolvedValue({ status: 'provisioning' }),
    };

    const deps = {
      repository: repository as never,
      provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
      getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'blocked' }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ready', driftSummary: 'ok' }),
      getKeycloakStatus: vi.fn().mockResolvedValue({ realmExists: false }),
    } as never;

    const result = await processClaimedKeycloakProvisioningRun(deps, {
      id: 'run-blocked',
      instanceId: 'demo',
      mode: 'existing',
      intent: 'provision',
      overallStatus: 'running',
      driftSummary: '',
      requestId: 'req-5',
      actorId: 'actor-5',
      createdAt: '',
      updatedAt: '',
      steps: [{ stepKey: 'queued', details: {} }],
    });

    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-blocked', overallStatus: 'failed' })
    );
    expect(result).toEqual({ id: 'run-blocked', overallStatus: 'failed' });
  });
});
