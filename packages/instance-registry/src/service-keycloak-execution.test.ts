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
  failClaimedRun: vi.fn(),
  failRun: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./service-keycloak.js', () => ({
  createGetKeycloakStatusHandler: vi.fn(),
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
    state.failClaimedRun.mockReset();
    state.failRun.mockReset();

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.appendRunStep.mockResolvedValue(undefined);
    state.completeRun.mockResolvedValue('succeeded');
    state.readQueuedTemporaryPassword.mockReturnValue(undefined);
    state.syncProvisionedClientSecretToRegistry.mockResolvedValue(undefined);
    state.syncRotatedClientSecretToRegistry.mockResolvedValue(undefined);
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
          getKeycloakStatus: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({ overallStatus: 'ok', driftSummary: 'ok' }),
        } as never,
        createRun({ intent: 'rotate_client_secret', mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(state.syncRotatedClientSecretToRegistry).toHaveBeenCalled();
    expect(state.syncProvisionedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.completeRun).toHaveBeenCalled();
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
});
