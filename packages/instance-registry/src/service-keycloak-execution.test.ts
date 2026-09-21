import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  loadInstanceWithSecret: vi.fn(),
  loadKeycloakSnapshotSecretVersions: vi.fn(),
  appendRunStep: vi.fn(),
  assertQueuedRealmBaselineCurrent: vi.fn(),
  buildProvisioningInput: vi.fn(),
  completeRun: vi.fn(),
  createQueuedRun: vi.fn(),
  readQueuedPluginOidcClientRequirements: vi.fn(),
  readQueuedTemporaryPassword: vi.fn(),
  syncProvisionedClientSecretToRegistry: vi.fn(),
  syncRotatedClientSecretToRegistry: vi.fn(),
  syncTenantAdminBootstrapAccount: vi.fn(),
  failClaimedRun: vi.fn(),
  failRun: vi.fn(),
  createGetKeycloakPreflightHandler: vi.fn(),
  createPlanKeycloakProvisioningHandler: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./service-keycloak-readers.js', () => ({
  createGetKeycloakStatusHandler: vi.fn(),
  createGetKeycloakPreflightHandler: state.createGetKeycloakPreflightHandler,
  createPlanKeycloakProvisioningHandler: state.createPlanKeycloakProvisioningHandler,
}));

vi.mock('./service-keycloak-secrets.js', () => ({
  loadInstanceWithSecret: state.loadInstanceWithSecret,
  loadKeycloakSnapshotSecretVersions: state.loadKeycloakSnapshotSecretVersions,
}));

vi.mock('./service-keycloak-run-steps.js', () => ({
  appendRunStep: state.appendRunStep,
}));

vi.mock('./service-keycloak-execution-shared.js', () => ({
  assertQueuedRealmBaselineCurrent: state.assertQueuedRealmBaselineCurrent,
  buildProvisioningInput: state.buildProvisioningInput,
  completeRun: state.completeRun,
  createQueuedRun: state.createQueuedRun,
  readQueuedPluginOidcClientRequirements: state.readQueuedPluginOidcClientRequirements,
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

const confirmedPlanFingerprint = 'a'.repeat(64);

const createRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  instanceId: 'instance-1',
  requestId: 'request-1',
  actorId: 'actor-1',
  intent: 'provision',
  mode: 'new',
  overallStatus: 'running',
  steps: [{ stepKey: 'queued', details: { confirmedPlanFingerprint } }],
  ...overrides,
});

describe('service-keycloak-execution', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.error.mockReset();
    state.loadInstanceWithSecret.mockReset();
    state.loadKeycloakSnapshotSecretVersions.mockReset();
    state.appendRunStep.mockReset();
    state.assertQueuedRealmBaselineCurrent.mockReset();
    state.buildProvisioningInput.mockReset();
    state.completeRun.mockReset();
    state.createQueuedRun.mockReset();
    state.readQueuedPluginOidcClientRequirements.mockReset();
    state.readQueuedTemporaryPassword.mockReset();
    state.syncProvisionedClientSecretToRegistry.mockReset();
    state.syncRotatedClientSecretToRegistry.mockReset();
    state.syncTenantAdminBootstrapAccount.mockReset();
    state.failClaimedRun.mockReset();
    state.failRun.mockReset();
    state.createGetKeycloakPreflightHandler.mockReset();
    state.createPlanKeycloakProvisioningHandler.mockReset();

    state.buildProvisioningInput.mockReturnValue({ payload: 'provisioning' });
    state.loadKeycloakSnapshotSecretVersions.mockResolvedValue({
      authClientSecretCiphertext: null,
      tenantAdminClientSecretCiphertext: null,
    });
    state.appendRunStep.mockResolvedValue(undefined);
    state.completeRun.mockResolvedValue('succeeded');
    state.readQueuedTemporaryPassword.mockReturnValue(undefined);
    state.readQueuedPluginOidcClientRequirements.mockReturnValue([]);
    state.syncProvisionedClientSecretToRegistry.mockResolvedValue(undefined);
    state.syncRotatedClientSecretToRegistry.mockResolvedValue(undefined);
    state.syncTenantAdminBootstrapAccount.mockResolvedValue(undefined);
    state.failClaimedRun.mockResolvedValue(undefined);
    state.failRun.mockResolvedValue(undefined);
    state.createGetKeycloakPreflightHandler.mockReturnValue(
      vi.fn(async () => ({ overallStatus: 'ready', checks: [] }))
    );
    state.createPlanKeycloakProvisioningHandler.mockReturnValue(
      vi.fn(async () => ({
        contractVersion: '1.0',
        fingerprint: confirmedPlanFingerprint,
        overallStatus: 'ready',
      }))
    );
  });

  it('returns null when no claimed run is available', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: {},
        } as never,
        null
      )
    ).resolves.toBeNull();
  });

  it('allows legacy role migration only for a uniquely assigned realm in every realm mode', async () => {
    const { isLegacyRealmRoleMigrationAllowed, resolveLegacyRealmRoleMigrationAllowed } =
      await import('./provisioning-auth-policy.js');
    const current = { instanceId: 'tenant-havelland', authRealm: 'havelland' };

    expect(isLegacyRealmRoleMigrationAllowed([current], current)).toBe(true);
    expect(
      isLegacyRealmRoleMigrationAllowed(
        [current, { instanceId: 'tenant-other', authRealm: 'havelland' }],
        current
      )
    ).toBe(false);
    await expect(
      resolveLegacyRealmRoleMigrationAllowed(
        { listInstances: vi.fn().mockResolvedValue([current]) },
        current
      )
    ).resolves.toBe(true);
  });

  it('keeps snapshot fingerprints stable across status-only instance transitions', async () => {
    const { buildKeycloakSnapshotInputFingerprint } = await import('./provisioning-auth-policy.js');
    const provisioning = {
      instanceId: 'tenant-havelland',
      primaryHostname: 'havelland.example.test',
      realmMode: 'existing' as const,
      authRealm: 'havelland',
      authClientId: 'studio-client',
      authClientSecretConfigured: true,
      status: 'provisioning',
      updatedAt: '2026-09-11T10:00:00.000Z',
    };

    expect(
      buildKeycloakSnapshotInputFingerprint({
        ...provisioning,
        status: 'active',
        updatedAt: '2026-09-11T10:01:00.000Z',
      })
    ).toBe(buildKeycloakSnapshotInputFingerprint(provisioning));
    expect(buildKeycloakSnapshotInputFingerprint({ ...provisioning, authRealm: 'other' })).not.toBe(
      buildKeycloakSnapshotInputFingerprint(provisioning)
    );
    expect(
      buildKeycloakSnapshotInputFingerprint(provisioning, {
        authClientSecretCiphertext: 'rotated-ciphertext',
      })
    ).not.toBe(buildKeycloakSnapshotInputFingerprint(provisioning));
    expect(
      buildKeycloakSnapshotInputFingerprint(provisioning, undefined, [
        {
          contractVersion: '1.0',
          pluginId: 'ssf',
          clientId: 'ssf',
          audience: 'ssf',
          enabled: false,
        },
      ])
    ).not.toBe(buildKeycloakSnapshotInputFingerprint(provisioning));
  });

  it('fails claimed runs when worker dependencies are missing', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
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
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(null);

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn(),
          readKeycloakStateViaProvisioner: vi.fn(),
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
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      updateKeycloakProvisioningRun: vi.fn().mockResolvedValue(undefined),
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn(),
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'blocked' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
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

  it('executes technical repairs for an imported realm without admin bootstrap data', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const getKeycloakPreflight = vi.fn().mockResolvedValue({
      overallStatus: 'warning',
      checks: [{ checkKey: 'tenant_admin_profile', status: 'warning' }],
    });
    const planKeycloakProvisioning = vi.fn().mockResolvedValue({
      overallStatus: 'ready',
      driftSummary: 'Technische Reparatur erforderlich.',
      fingerprint: confirmedPlanFingerprint,
    });
    const pluginOidcClients = [
      {
        contractVersion: '1.0',
        pluginId: 'ssf',
        clientId: 'ssf',
        audience: 'ssf',
        enabled: false,
      },
    ];
    state.readQueuedPluginOidcClientRequirements.mockReturnValue(pluginOidcClients);
    const listProvisioningRealmAssignments = vi
      .fn()
      .mockResolvedValue([{ instanceId: 'instance-1', authRealm: 'tenant' }]);
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      instance: {
        ...createLoaded().instance,
        realmMode: 'existing',
        tenantAdminClient: { clientId: 'tenant-admin' },
      },
      tenantAdminClientSecret: 'tenant-admin-secret',
    });

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          listProvisioningRealmAssignments,
          provisionInstanceAuth,
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight,
          planKeycloakProvisioning,
        } as never,
        createRun({
          mode: 'new',
          steps: [
            {
              stepKey: 'queued',
              details: {
                confirmedPlanFingerprint,
                pluginOidcSnapshotVersion: '1.0',
                pluginOidcClients,
              },
            },
          ],
        })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: 'provisioning',
        allowLegacyRealmRoleMigration: true,
        pluginOidcClients,
        reconcileAuthClient: true,
        reconcileTenantAdminClient: true,
      })
    );
    expect(getKeycloakPreflight).toHaveBeenCalledWith(
      expect.objectContaining({ pluginOidcClients })
    );
    expect(planKeycloakProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({ pluginOidcClients })
    );
    expect(state.assertQueuedRealmBaselineCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ pluginOidcSnapshotVersion: '1.0' }),
      'new'
    );
    expect(state.completeRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pluginOidcClients })
    );
  });

  it('fails a claimed run when its queued plugin OIDC snapshot is missing', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const snapshotError = new Error('queued_plugin_oidc_client_requirements_missing_or_invalid');
    const provisionInstanceAuth = vi.fn();
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.readQueuedPluginOidcClientRequirements.mockImplementation(() => {
      throw snapshotError;
    });

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn(),
          planKeycloakProvisioning: vi.fn(),
        } as never,
        createRun({
          steps: [{ stepKey: 'queued', details: { confirmedPlanFingerprint } }],
        })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: 'run-1', error: snapshotError })
    );
    expect(provisionInstanceAuth).not.toHaveBeenCalled();
  });

  it('fails a claimed run when the realm ownership lookup fails', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const lookupError = new Error('registry_unavailable');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      instance: { ...createLoaded().instance, realmMode: 'existing' },
    });

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          listProvisioningRealmAssignments: vi.fn().mockRejectedValue(lookupError),
          provisionInstanceAuth: vi.fn(),
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn(),
          planKeycloakProvisioning: vi.fn(),
        } as never,
        createRun({ mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: 'run-1', error: lookupError })
    );
  });

  it('processes rotate_client_secret runs with the rotated secret sync path', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
        } as never,
        createRun({ intent: 'rotate_client_secret', mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(state.syncRotatedClientSecretToRegistry).toHaveBeenCalled();
    expect(state.syncProvisionedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.syncTenantAdminBootstrapAccount).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      tenantAdminBootstrap: undefined,
      tenantAdminClientSecret: undefined,
      requestId: 'request-1',
      actorId: 'actor-1',
    });
    expect(state.completeRun).toHaveBeenCalled();
  });

  it('passes the freshly synchronized tenant admin secret to the bootstrap adapter', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const loaded = createLoaded();
    loaded.instance.tenantAdminBootstrap = { username: 'tenant.admin' };
    loaded.instance.tenantAdminClient = { clientId: 'tenant-admin' };
    state.loadInstanceWithSecret.mockResolvedValue(loaded);
    state.syncProvisionedClientSecretToRegistry.mockImplementationOnce(
      async (_deps, { loaded: input }) => {
        input.tenantAdminClientSecret = 'fresh-tenant-admin-secret';
      }
    );
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };

    await processClaimedKeycloakProvisioningRun(
      {
        repository: repository as never,
        provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
        syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
        readKeycloakStateViaProvisioner: vi.fn(),
        getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
        planKeycloakProvisioning: vi.fn().mockResolvedValue({
          overallStatus: 'ok',
          driftSummary: 'ok',
          fingerprint: confirmedPlanFingerprint,
        }),
      } as never,
      createRun()
    );

    expect(state.syncTenantAdminBootstrapAccount).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      tenantAdminBootstrap: { username: 'tenant.admin' },
      tenantAdminClientSecret: 'fresh-tenant-admin-secret',
      requestId: 'request-1',
      actorId: 'actor-1',
    });
  });

  it('does not sync a rotated secret when provisioning fails before rotation', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
      completeProvisioningRemediation: vi.fn().mockResolvedValue(null),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi
            .fn()
            .mockRejectedValue(new Error('plugin_oidc_client_readback_failed:ssf:ssf')),
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
        } as never,
        createRun({ intent: 'rotate_client_secret', mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(state.syncRotatedClientSecretToRegistry).not.toHaveBeenCalled();
    expect(state.completeRun).not.toHaveBeenCalled();
    expect(repository.completeProvisioningRemediation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      childKeycloakRunId: 'run-1',
      succeeded: false,
    });
  });

  it('recovers a missing tenant secret even when the derived plan remains blocked', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      authClientSecret: undefined,
    });

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({
            overallStatus: 'blocked',
            checks: [{ checkKey: 'tenant_secret', status: 'blocked' }],
          }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'blocked',
            driftSummary: 'blocked',
            fingerprint: confirmedPlanFingerprint,
            steps: [
              { stepKey: 'realm', status: 'blocked' },
              { stepKey: 'secret', status: 'blocked' },
            ],
          }),
        } as never,
        createRun({ intent: 'rotate_client_secret', mode: 'existing' })
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'succeeded' });

    expect(provisionInstanceAuth).toHaveBeenCalledWith(
      expect.objectContaining({ rotateClientSecret: true })
    );
    expect(state.syncRotatedClientSecretToRegistry).toHaveBeenCalled();
  });

  it('limits reset_tenant_admin runs to tenant-admin user reconciliation', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
    };
    const provisionInstanceAuth = vi.fn().mockResolvedValue(undefined);
    const loaded = createLoaded();
    state.loadInstanceWithSecret.mockResolvedValue({
      ...loaded,
      instance: { ...loaded.instance, realmMode: 'existing' },
    });
    state.buildProvisioningInput.mockReturnValue({
      payload: 'provisioning',
      realmMode: 'existing',
    });
    state.readQueuedTemporaryPassword.mockReturnValue('tmp-password');

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth,
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
        } as never,
        createRun({
          intent: 'reset_tenant_admin',
          mode: 'existing',
          steps: [{ stepKey: 'queued', details: { confirmedPlanFingerprint } }],
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
      tenantAdminClientSecret: undefined,
      requestId: 'request-1',
      actorId: 'actor-1',
    });
  });

  it('rejects tenant-admin-only reset runs while the instance still owns a new realm', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    const handler = createExecuteKeycloakProvisioningHandler({
      repository: { listProvisioningRuns: vi.fn().mockResolvedValue([]) } as never,
    } as never);

    await expect(
      handler({
        instanceId: 'instance-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'reset_tenant_admin',
      } as never)
    ).rejects.toThrow('reset_tenant_admin_requires_existing_realm');
    expect(state.createQueuedRun).not.toHaveBeenCalled();
  });

  it('passes the configured tenant admin bootstrap to the local sync hook after provisioning', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'succeeded' }),
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
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
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
      tenantAdminClientSecret: undefined,
      requestId: 'request-1',
      actorId: 'actor-1',
    });
  });

  it('fails the run when execution throws and reloads the persisted run state', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.syncProvisionedClientSecretToRegistry.mockRejectedValue(new Error('database error'));

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
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

  it('removes a newly created realm when final validation reports failure', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const deleteProvisionedRealm = vi.fn().mockResolvedValue(undefined);
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.buildProvisioningInput.mockReturnValue({
      instanceId: 'instance-1',
      authRealm: 'tenant',
      realmMode: 'new',
    });
    state.completeRun.mockResolvedValue('failed');

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          deleteProvisionedRealm,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(deleteProvisionedRealm).toHaveBeenCalledWith('tenant');
  });

  it('removes a newly created realm when final validation cannot be read', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const deleteProvisionedRealm = vi.fn().mockResolvedValue(undefined);
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.buildProvisioningInput.mockReturnValue({
      instanceId: 'instance-1',
      authRealm: 'tenant',
      realmMode: 'new',
    });
    state.completeRun.mockRejectedValue(new Error('final-read-failed'));

    await expect(
      processClaimedKeycloakProvisioningRun(
        {
          repository: repository as never,
          provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
          syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
          deleteProvisionedRealm,
          readKeycloakStateViaProvisioner: vi.fn(),
          getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
          planKeycloakProvisioning: vi.fn().mockResolvedValue({
            overallStatus: 'ok',
            driftSummary: 'ok',
            fingerprint: confirmedPlanFingerprint,
          }),
        } as never,
        createRun()
      )
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'failed' });

    expect(deleteProvisionedRealm).toHaveBeenCalledWith('tenant');
    expect(state.syncTenantAdminBootstrapAccount).not.toHaveBeenCalled();
    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: 'run-1', error: expect.any(Error) })
    );
  });

  it('does not delete an accepted new realm when the later local bootstrap sync fails', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const deleteProvisionedRealm = vi.fn();
    const loaded = createLoaded();
    state.loadInstanceWithSecret.mockResolvedValueOnce(loaded).mockResolvedValueOnce({
      ...loaded,
      instance: { ...loaded.instance, realmMode: 'existing' },
    });
    state.buildProvisioningInput.mockReturnValue({
      instanceId: 'instance-1',
      authRealm: 'tenant',
      realmMode: 'new',
    });
    state.completeRun.mockResolvedValue('succeeded');
    state.syncTenantAdminBootstrapAccount.mockRejectedValue(new Error('local-bootstrap-failed'));

    await processClaimedKeycloakProvisioningRun(
      {
        repository: {
          getKeycloakProvisioningRun: vi
            .fn()
            .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
        } as never,
        provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
        syncTenantAdminBootstrapAccount: state.syncTenantAdminBootstrapAccount,
        deleteProvisionedRealm,
        readKeycloakStateViaProvisioner: vi.fn(),
        getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
        planKeycloakProvisioning: vi.fn().mockResolvedValue({
          overallStatus: 'ok',
          driftSummary: 'ok',
          fingerprint: confirmedPlanFingerprint,
        }),
      } as never,
      createRun()
    );

    expect(state.completeRun.mock.invocationCallOrder[0]).toBeLessThan(
      state.syncTenantAdminBootstrapAccount.mock.invocationCallOrder[0] ?? 0
    );
    expect(deleteProvisionedRealm).not.toHaveBeenCalled();
    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run-1',
        error: expect.objectContaining({
          message: 'new_realm_accepted_post_provisioning_sync_failed_retry_safe',
          cause: expect.objectContaining({ message: 'local-bootstrap-failed' }),
          instanceRegistryStep: 'admin_bootstrap',
        }),
      })
    );
  });

  it('does not delete the realm when finalization already committed the existing mode', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const deleteProvisionedRealm = vi.fn();
    const loaded = createLoaded();
    state.loadInstanceWithSecret.mockResolvedValueOnce(loaded).mockResolvedValueOnce({
      ...loaded,
      instance: { ...loaded.instance, realmMode: 'existing' },
    });
    state.buildProvisioningInput.mockReturnValue({
      instanceId: 'instance-1',
      authRealm: 'tenant',
      realmMode: 'new',
    });
    state.completeRun.mockRejectedValue(new Error('late-finalization-failure'));

    await processClaimedKeycloakProvisioningRun(
      {
        repository: {
          getKeycloakProvisioningRun: vi
            .fn()
            .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
        } as never,
        provisionInstanceAuth: vi.fn().mockResolvedValue(undefined),
        deleteProvisionedRealm,
        readKeycloakStateViaProvisioner: vi.fn(),
        getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ok' }),
        planKeycloakProvisioning: vi.fn().mockResolvedValue({
          overallStatus: 'ok',
          driftSummary: 'ok',
          fingerprint: confirmedPlanFingerprint,
        }),
      } as never,
      createRun()
    );

    expect(deleteProvisionedRealm).not.toHaveBeenCalled();
  });

  it('enqueues provisioning runs only for existing instances', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'queued' }),
      listProvisioningRuns: vi.fn().mockResolvedValue([]),
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
        planFingerprint: confirmedPlanFingerprint,
      } as never)
    ).resolves.toBeNull();

    await expect(
      handler({
        instanceId: 'instance-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'provision',
        planFingerprint: confirmedPlanFingerprint,
      } as never)
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'queued' });

    expect(state.createQueuedRun).toHaveBeenCalled();
    expect(repository.getKeycloakProvisioningRun).toHaveBeenCalledWith('instance-1', 'run-1');
  });

  it('rejects a stale confirmed plan before enqueuing any mutation', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    const repository = { listProvisioningRuns: vi.fn().mockResolvedValue([]) };
    const handler = createExecuteKeycloakProvisioningHandler({
      repository: repository as never,
    } as never);

    await expect(
      handler({
        instanceId: 'instance-1',
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'provision',
        planFingerprint: 'b'.repeat(64),
      })
    ).rejects.toThrow('keycloak_plan_fingerprint_stale');
    expect(state.createQueuedRun).not.toHaveBeenCalled();
  });

  it('binds an explicit plan confirmation to the waiting automated parent run', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    state.createQueuedRun.mockResolvedValue({ run: { id: 'run-1' } });
    const parentRun = {
      id: 'parent-1',
      operation: 'create',
      status: 'validated',
      snapshotVersion: '3.0',
      desiredSnapshot: { automationMode: 'kassel-traefik-file' },
      terminalEvidence: {
        keycloakPlanGate: {
          status: 'awaiting_plan_confirmation',
          planFingerprint: 'b'.repeat(64),
        },
      },
    };
    const repository = {
      listProvisioningRuns: vi.fn().mockResolvedValue([parentRun]),
      confirmProvisioningPlan: vi.fn().mockResolvedValue({
        ...parentRun,
        status: 'provisioning',
        stepKey: 'keycloak',
        childKeycloakRunId: 'run-1',
      }),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
    };

    await expect(
      createExecuteKeycloakProvisioningHandler({ repository: repository as never } as never)({
        instanceId: 'instance-1',
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        actorId: 'operator-1',
        intent: 'provision',
        planFingerprint: confirmedPlanFingerprint,
      })
    ).resolves.toEqual({ id: 'run-1' });

    expect(repository.confirmProvisioningPlan).toHaveBeenCalledWith({
      runId: 'parent-1',
      instanceId: 'instance-1',
      expectedPlanFingerprint: 'b'.repeat(64),
      planFingerprint: confirmedPlanFingerprint,
      childKeycloakRunId: 'run-1',
      actorId: 'operator-1',
      requestId: 'request-1',
    });
  });

  it('enqueues missing-secret recovery when tenant_secret is the only blocker', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      instance: { ...createLoaded().instance, realmMode: 'existing' },
      authClientSecret: undefined,
    });
    state.createGetKeycloakPreflightHandler.mockReturnValue(
      vi.fn(async () => ({
        overallStatus: 'blocked',
        checks: [{ checkKey: 'tenant_secret', status: 'blocked' }],
      }))
    );
    state.createPlanKeycloakProvisioningHandler.mockReturnValue(
      vi.fn(async () => ({
        contractVersion: '1.0',
        fingerprint: confirmedPlanFingerprint,
        overallStatus: 'blocked',
      }))
    );
    state.createQueuedRun.mockResolvedValue({ run: { id: 'run-1' } });
    const parentRun = {
      id: 'parent-1',
      operation: 'create',
      status: 'validated',
      snapshotVersion: '3.0',
      desiredSnapshot: { automationMode: 'kassel-traefik-file' },
      terminalEvidence: {
        keycloakPlanGate: {
          status: 'awaiting_tenant_secret',
          planFingerprint: confirmedPlanFingerprint,
        },
      },
    };
    const repository = {
      listProvisioningRuns: vi.fn().mockResolvedValue([parentRun]),
      bindProvisioningRemediation: vi.fn().mockResolvedValue(parentRun),
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'queued' }),
    };

    await expect(
      createExecuteKeycloakProvisioningHandler({ repository: repository as never } as never)({
        instanceId: 'instance-1',
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'rotate_client_secret',
        planFingerprint: confirmedPlanFingerprint,
      })
    ).resolves.toEqual({ id: 'run-1', overallStatus: 'queued' });

    expect(state.createQueuedRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ intent: 'rotate_client_secret' })
    );
    expect(repository.bindProvisioningRemediation).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'parent-1',
        childKeycloakRunId: 'run-1',
        actorId: 'actor-1',
      })
    );
  });

  it('keeps missing-secret recovery blocked when another preflight blocker exists', async () => {
    const { createExecuteKeycloakProvisioningHandler } =
      await import('./service-keycloak-execution.js');
    state.loadInstanceWithSecret.mockResolvedValue({
      ...createLoaded(),
      instance: { ...createLoaded().instance, realmMode: 'existing' },
      authClientSecret: undefined,
    });
    state.createGetKeycloakPreflightHandler.mockReturnValue(
      vi.fn(async () => ({
        overallStatus: 'blocked',
        checks: [
          { checkKey: 'tenant_secret', status: 'blocked' },
          { checkKey: 'realm', status: 'blocked' },
        ],
      }))
    );
    state.createPlanKeycloakProvisioningHandler.mockReturnValue(
      vi.fn(async () => ({
        contractVersion: '1.0',
        fingerprint: confirmedPlanFingerprint,
        overallStatus: 'blocked',
      }))
    );
    const repository = { listProvisioningRuns: vi.fn().mockResolvedValue([]) };

    await expect(
      createExecuteKeycloakProvisioningHandler({ repository: repository as never } as never)({
        instanceId: 'instance-1',
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        actorId: 'actor-1',
        intent: 'rotate_client_secret',
        planFingerprint: confirmedPlanFingerprint,
      })
    ).rejects.toThrow('keycloak_plan_blocked');
    expect(state.createQueuedRun).not.toHaveBeenCalled();
  });

  it('rejects worker execution when the current readback changes the confirmed plan', async () => {
    const { processClaimedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const provisionInstanceAuth = vi.fn();
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    const repository = {
      getKeycloakProvisioningRun: vi
        .fn()
        .mockResolvedValue({ id: 'run-1', overallStatus: 'failed' }),
    };

    await processClaimedKeycloakProvisioningRun(
      {
        repository: repository as never,
        provisionInstanceAuth,
        readKeycloakStateViaProvisioner: vi.fn(),
        getKeycloakPreflight: vi.fn().mockResolvedValue({ overallStatus: 'ready', checks: [] }),
        planKeycloakProvisioning: vi.fn().mockResolvedValue({
          contractVersion: '1.0',
          overallStatus: 'ready',
          driftSummary: 'changed',
          fingerprint: 'b'.repeat(64),
          steps: [
            {
              stepKey: 'realm',
              action: 'verify',
              status: 'ready',
              details: { realm: 'tenant' },
            },
          ],
        }),
      } as never,
      createRun({
        steps: [
          {
            stepKey: 'queued',
            details: {
              confirmedPlanFingerprint,
              confirmedPlanContractVersion: '1.0',
              confirmedPlanSteps: [
                {
                  stepKey: 'realm',
                  action: 'create',
                  status: 'ready',
                  details: { realm: 'tenant' },
                },
              ],
            },
          },
        ],
      })
    );

    expect(state.failRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'keycloak_plan_fingerprint_stale',
          instanceRegistryStep: 'worker_plan',
        }),
      })
    );
    expect(provisionInstanceAuth).not.toHaveBeenCalled();
  });

  it('surfaces blocked preflight summaries before enqueuing reconcile runs', async () => {
    const { createReconcileKeycloakHandler } = await import('./service-keycloak-execution.js');
    const createQueuedRun = vi.fn();
    state.loadInstanceWithSecret.mockResolvedValue(createLoaded());
    const handler = createReconcileKeycloakHandler({
      repository: {
        listProvisioningRuns: vi.fn().mockResolvedValue([]),
      } as never,
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
      planKeycloakProvisioning: vi.fn().mockResolvedValue({
        overallStatus: 'ok',
        driftSummary: 'ok',
        fingerprint: confirmedPlanFingerprint,
      }),
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
    const { processNextQueuedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(null),
    };

    await expect(
      processNextQueuedKeycloakProvisioningRun({
        repository: repository as never,
        withInstanceProvisioningLock: vi.fn(),
      } as never)
    ).resolves.toBeNull();

    expect(repository.claimNextKeycloakProvisioningRun).toHaveBeenCalledTimes(1);
  });

  it('passes claim filters through to the repository helper', async () => {
    const { processNextQueuedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const repository = {
      claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(null),
    };

    await expect(
      processNextQueuedKeycloakProvisioningRun(
        {
          repository: repository as never,
          withInstanceProvisioningLock: vi.fn(),
        } as never,
        { createdAtOrAfter: '2026-05-27T12:00:00.000Z' }
      )
    ).resolves.toBeNull();

    expect(repository.claimNextKeycloakProvisioningRun).toHaveBeenCalledWith({
      createdAtOrAfter: '2026-05-27T12:00:00.000Z',
    });
  });

  it('validates the instance lock dependency before claiming a run', async () => {
    const { processNextQueuedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const claimNextKeycloakProvisioningRun = vi.fn();

    await expect(
      processNextQueuedKeycloakProvisioningRun({
        repository: { claimNextKeycloakProvisioningRun } as never,
      } as never)
    ).rejects.toThrow('dependency_missing_withInstanceProvisioningLock');

    expect(claimNextKeycloakProvisioningRun).not.toHaveBeenCalled();
  });

  it('processes a claimed run only inside its instance provisioning lock', async () => {
    const { processNextQueuedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const run = createRun();
    const lockedRepository = {
      getInstanceById: vi.fn().mockResolvedValue(null),
      getKeycloakProvisioningRun: vi.fn().mockResolvedValue(run),
    };
    const lockedDeps = {
      repository: lockedRepository,
      provisionInstanceAuth: vi.fn(),
      readKeycloakStateViaProvisioner: vi.fn(),
      getKeycloakPreflight: vi.fn(),
      planKeycloakProvisioning: vi.fn(),
    } as never;
    const withInstanceProvisioningLock = vi.fn(async (_instanceId, work) => work(lockedDeps));
    const readKeycloakClientSecretsViaProvisioner = vi.fn();

    await processNextQueuedKeycloakProvisioningRun({
      repository: { claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(run) } as never,
      readKeycloakClientSecretsViaProvisioner,
      withInstanceProvisioningLock,
    } as never);

    expect(withInstanceProvisioningLock).toHaveBeenCalledWith('instance-1', expect.any(Function));
    expect(lockedRepository.getKeycloakProvisioningRun).toHaveBeenCalledWith('instance-1', 'run-1');
    expect(state.loadInstanceWithSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: lockedRepository,
        readKeycloakClientSecretsViaProvisioner,
      }),
      'instance-1'
    );
  });

  it('skips a claimed run that is no longer running after acquiring the lock', async () => {
    const { processNextQueuedKeycloakProvisioningRun } =
      await import('./service-keycloak-execution.js');
    const run = createRun();
    const persistedRun = createRun({ overallStatus: 'failed' });
    const lockedDeps = {
      repository: {
        getKeycloakProvisioningRun: vi.fn().mockResolvedValue(persistedRun),
      },
    } as never;

    await expect(
      processNextQueuedKeycloakProvisioningRun({
        repository: { claimNextKeycloakProvisioningRun: vi.fn().mockResolvedValue(run) } as never,
        withInstanceProvisioningLock: vi.fn(async (_instanceId, work) => work(lockedDeps)),
      } as never)
    ).resolves.toEqual(persistedRun);

    expect(state.loadInstanceWithSecret).not.toHaveBeenCalled();
  });
});
