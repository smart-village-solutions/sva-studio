import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  loadInstanceWithSecret: vi.fn(),
  appendRunStep: vi.fn(),
  buildProvisioningInput: vi.fn(),
  completeRun: vi.fn(),
  createQueuedRun: vi.fn(),
  readQueuedTemporaryPassword: vi.fn(),
  syncProvisionedClientSecretToRegistry: vi.fn(),
  syncRotatedClientSecretToRegistry: vi.fn(),
  syncTenantAdminBootstrapAccount: vi.fn(),
  failClaimedRun: vi.fn(),
  failRun: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./service-keycloak-readers.js', () => ({
  createGetKeycloakStatusHandler: vi.fn(),
}));

vi.mock('./service-keycloak-secrets.js', () => ({
  loadInstanceWithSecret: state.loadInstanceWithSecret,
}));

vi.mock('./service-keycloak-run-steps.js', () => ({
  appendRunStep: state.appendRunStep,
}));

vi.mock('./service-keycloak-execution-shared.js', () => ({
  buildProvisioningInput: state.buildProvisioningInput,
  completeRun: state.completeRun,
  createQueuedRun: state.createQueuedRun,
  readQueuedTemporaryPassword: state.readQueuedTemporaryPassword,
  syncProvisionedClientSecretToRegistry: state.syncProvisionedClientSecretToRegistry,
  syncRotatedClientSecretToRegistry: state.syncRotatedClientSecretToRegistry,
}));

vi.mock('./service-keycloak-execution-failures.js', () => ({
  failClaimedRun: state.failClaimedRun,
  failRun: state.failRun,
}));

const createLoaded = () => ({
  instance: {
    instanceId: 'instance-1',
    primaryHostname: 'tenant.example.test',
    realmMode: 'new',
    authRealm: 'tenant',
    authClientId: 'studio-client',
    authIssuerUrl: 'https://issuer.example.test/realms/tenant',
    displayName: 'Tenant',
    parentDomain: 'example.test',
    tenantAdminBootstrap: undefined,
    tenantAdminClient: undefined,
    themeKey: 'default',
    featureFlags: {},
    mainserverConfigRef: null,
  },
  authClientSecret: 'auth-secret',
  tenantAdminClientSecret: undefined,
});

const createRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  instanceId: 'instance-1',
  requestId: 'request-1',
  actorId: 'actor-1',
  intent: 'provision',
  mode: 'new',
  steps: [],
  ...overrides,
});

describe('service-keycloak-execution', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.error.mockReset();
    state.loadInstanceWithSecret.mockReset();
    state.appendRunStep.mockReset();
    state.buildProvisioningInput.mockReset();
    state.completeRun.mockReset();
    state.createQueuedRun.mockReset();
    state.readQueuedTemporaryPassword.mockReset();
    state.syncProvisionedClientSecretToRegistry.mockReset();
    state.syncRotatedClientSecretToRegistry.mockReset();
    state.syncTenantAdminBootstrapAccount.mockReset();
    state.failClaimedRun.mockReset();
    state.failRun.mockReset();

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.appendRunStep.mockResolvedValue(undefined);
    state.completeRun.mockResolvedValue('succeeded');
    state.readQueuedTemporaryPassword.mockReturnValue(undefined);
    state.syncProvisionedClientSecretToRegistry.mockResolvedValue(undefined);
    state.syncRotatedClientSecretToRegistry.mockResolvedValue(undefined);
    state.syncTenantAdminBootstrapAccount.mockResolvedValue(undefined);
    state.failClaimedRun.mockResolvedValue(undefined);
    state.failRun.mockResolvedValue(undefined);
  });

  it('returns null when no claimed run is available', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: {},
        } as never,
        null
      )
    ).resolves.toBeNull();
  });

  it('fails claimed runs when worker dependencies are missing', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.failClaimedRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
        summary: 'Provisioning-Worker ist unvollständig konfiguriert.',
      })
    );
  });

  it('returns the persisted run when the claimed instance no longer exists', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(null);

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn(),
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn(),
          planKeycloakProvisioning: vi.fn(),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.failClaimedRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
        details: { reason: 'instance_not_found' },
      })
    );
  });

  it('marks runs as failed when preflight or plan reports blockers', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn(),
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'blocked' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(repository.updateKeycloakProvisioningRun).toHaveBeenCalledWith({
      runId: 'run-1',
      overallStatus: 'failed',
      driftSummary: 'Provisioning blockiert: Worker-Preflight oder Plan melden Blocker.',
    });
  });

  it('processes rotate_client_secret runs with the rotated secret sync path', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun({ intent: 'rotate_client_secret', mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(state.syncRotatedClientSecretToRegistry).toHaveBeenCalled();
    expect(state.syncProvisionedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.syncTenantAdminBootstrapAccount).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      tenantAdminBootstrap: undefined,
      requestId: 'request-1',
      actorId: 'actor-1',
    });
    expect(state.completeRun).toHaveBeenCalled();
  });

  it('limits reset_tenant_admin runs to tenant-admin user reconciliation', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.readQueuedTemporaryPassword.mockReturnValue('tmp-password');

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth,
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun({
          intent: 'reset_tenant_admin',
          mode: 'existing',
          steps: [{ stepKey: 'queued', details: {} }],
        })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantAdminTemporaryPassword: 'tmp-password',
        reconcileAuthClient: false,
        reconcileTenantAdminClient: false,
      })
    );
    expect(state.syncProvisionedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.syncRotatedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.syncTenantAdminBootstrapAccount).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      tenantAdminBootstrap: undefined,
      requestId: 'request-1',
      actorId: 'actor-1',
    });
  });

  it('passes the configured tenant admin bootstrap to the local sync hook after provisioning', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      instance: {
        ...createLoaded().instance,
        tenantAdminBootstrap: {
          username: 'tenant.admin',
          email: 'tenant.admin@example.test',
          firstName: 'Tenant',
          lastName: 'Admin',
        },
      },
    });

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(state.syncTenantAdminBootstrapAccount).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      tenantAdminBootstrap: {
        username: 'tenant.admin',
        email: 'tenant.admin@example.test',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      requestId: 'request-1',
      actorId: 'actor-1',
    });
  });

  it('fails the run when execution throws and reloads the persisted run state', async () => {
    const { processClaimedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.syncProvisionedClientSecretToRegistry.mockRejectedValue(new Error('database error'));

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
      })
    );
  });

  it('enqueues provisioning runs only for existing instances', async () => {
    const { createExecuteKeycloakProvisioningHandler } = await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1', overallStatus: 'queued' }),
    };
    const handler = createExecuteKeycloakProvisioningHandler({
      repository: repository as never,
    } as never);

    state.loadInstanceWithSecret.mockResolvedValueOnce(null).mockResolvedValueOnce(createLoaded());
    state.createQueuedRun.mockResolvedValue({
      run: { id: 'run-1' },
    });

    await expect(
      handler({
        instanceId: 'instance-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'provision',
      } as never)
    ).resolves.toBeNull();

    await expect(
      handler({
        instanceId: 'instance-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'provision',
      } as never)
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'queued' });

    expect(state.createQueuedRun).toHaveBeenCalled();
    expect(repository.getKeycloakProvisioningRun).toHaveBeenCalledWith('instance-1', 'run-1');
  });

  it('surfaces blocked preflight summaries before enqueuing reconcile runs', async () => {
    const { createReconcileKeycloakHandler } = await import('./service-keycloak-execution.js');
    const createQueuedRun = vi.fn();
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    const handler = createReconcileKeycloakHandler({
      repository: {} as never,
      createQueuedRun,
      getKeycloakPreflight: vi.fn().mockResolvedValue({
        overallStatus: 'blocked',
        checks: [
          { status: 'blocked', summary: 'Realm fehlt.' },
          { status: 'ok', summary: 'ignored' },
          { status: 'blocked', summary: '' },
          { status: 'blocked', summary: 'Client fehlt.' },
        ],
      }),
      planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
    } as never);

    await expect(
      handler({
        instanceId: 'instance-1',
        idempotencyKey: 'idem-1',
        actorId: 'actor-1',
        requestId: 'request-1',
      })
    ).rejects.toThrow('registry_or_provisioning_drift_blocked:Realm fehlt. Client fehlt.');

    expect(createQueuedRun).not.toHaveBeenCalled();
  });

  it('claims the next queued run via the repository helper', async () => {
    const { processNextQueuedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(null),
    };

    await expect(
      processNextQueuedKeycloakProvisioningRun({
        repository: repository as never,
      } as never)
    ).resolves.toBeNull();

    expect(repository.claimNextKeycloakProvisioningRun).toHaveBeenCalledTimes(1);
  });

  it('passes claim filters through to the repository helper', async () => {
    const { processNextQueuedKeycloakProvisioningRun } = await import('./service-keycloak-execution.js');
    const repository = {
      claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(null),
    };

    await expect(
      processNextQueuedKeycloakProvisioningRun(
        {
          repository: repository as never,
        } as never,
        { createdAtOrAfter: '2026-05-27T12:00:00.000Z' }
      )
    ).resolves.toBeNull();

    expect(repository.claimNextKeycloakProvisioningRun).toHaveBeenCalledWith({
      createdAtOrAfter: '2026-05-27T12:00:00.000Z',
    });
  });
});
