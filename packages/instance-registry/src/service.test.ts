import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

vi.mock('@sva/server-runtime', async () => {
  const actual = await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  return {
    ...actual,
    createSdkLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      isLevelEnabled: vi.fn(() => true),
    }),
  };
});

import { createInstanceRegistryService } from './service.js';
import { buildCreateInstancePayloadFingerprint } from './service-instance-create-fingerprint.js';
import { buildKeycloakSnapshotInputFingerprint } from './provisioning-auth-policy.js';
import {
  createGetKeycloakPreflightHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
} from './service-keycloak.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const baseInstance = {
  instanceId: 'demo',
  displayName: 'Demo',
  status: 'requested' as const,
  parentDomain: 'studio.example.org',
  primaryHostname: 'demo.studio.example.org',
  realmMode: 'new' as const,
  authRealm: 'demo',
  authClientId: 'studio-client',
  authIssuerUrl: 'https://auth.example.org/realms/demo',
  authClientSecretConfigured: true,
  tenantAdminClient: {
    clientId: 'tenant-admin',
    secretConfigured: true,
  },
  tenantAdminBootstrap: {
    username: 'tenant-admin',
    email: 'tenant-admin@example.invalid',
  },
  themeKey: 'default',
  assignedModules: ['news'],
  featureFlags: { beta: true },
  mainserverConfigRef: 'mainserver',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const latestRun = {
  id: 'run-1',
  instanceId: 'demo',
  operation: 'create' as const,
  status: 'requested' as const,
  idempotencyKey: 'idem-1',
  snapshotVersion: '2.0',
  desiredSnapshot: {},
  attemptCount: 0,
  nextAttemptAt: '2026-01-01T00:00:00.000Z',
  deadlineAt: '2026-01-01T00:30:00.000Z',
  terminalEvidence: {},
  payloadFingerprint: buildCreateInstancePayloadFingerprint({
    instanceId: 'demo',
    displayName: 'Demo',
    parentDomain: 'studio.example.org',
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'studio-client',
    idempotencyKey: 'idem-1',
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const latestRunWithAuthSecret = {
  ...latestRun,
  payloadFingerprint: buildCreateInstancePayloadFingerprint({
    instanceId: 'demo',
    displayName: 'Demo',
    parentDomain: 'studio.example.org',
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'studio-client',
    authClientSecret: 'original-secret',
    idempotencyKey: 'idem-1',
  }),
};

const idempotentInstance = {
  ...baseInstance,
  authClientSecretConfigured: false,
  tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
};

const createRepository = (
  overrides: Partial<InstanceRegistryRepository> = {}
): InstanceRegistryRepository =>
  ({
    listInstances: vi.fn(async () => [baseInstance]),
    getInstanceById: vi.fn(async () => baseInstance),
    listAssignedModules: vi.fn(async () => baseInstance.assignedModules),
    listModuleActivations: vi.fn(async () => []),
    getModuleActivationPolicy: vi.fn(async () => ({
      activationPolicy: 'optional' as const,
      activationOrigin: 'manual' as const,
      effectiveActive: true,
      manualOverride: 'enabled' as const,
      reconcileId: null,
      reconciledAt: null,
      stateRevision: 1,
      updatedBy: null,
    })),
    assignModule: vi.fn(async () => true),
    restoreModuleActivation: vi.fn(async () => true),
    revokeModule: vi.fn(async () => true),
    requestWasteProvisioning: vi.fn(async () => ({
      instanceId: 'demo',
      status: 'provisioning' as const,
      desiredGeneration: 1,
      completedGeneration: 0,
      requestedAt: '2026-08-02T08:00:00.000Z',
      updatedAt: '2026-08-02T08:00:00.000Z',
    })),
    getWasteProvisioning: vi.fn(async () => null),
    disableWasteProvisioning: vi.fn(async () => null),
    claimWasteProvisioning: vi.fn(async () => null),
    completeWasteProvisioning: vi.fn(async () => null),
    failWasteProvisioning: vi.fn(async () => null),
    failWasteProvisioningRequest: vi.fn(async () => null),
    syncAssignedModuleIam: vi.fn(async () => undefined),
    persistPluginTenantLifecycleReconcileIntents: vi.fn(
      async ({
        lifecycles,
      }: Parameters<
        InstanceRegistryRepository['persistPluginTenantLifecycleReconcileIntents']
      >[0]) => lifecycles.map(({ pluginId }) => pluginId)
    ),
    syncProtectedSystemRolePermissions: vi.fn(async () => undefined),
    countLocalSystemAdminAssignments: vi.fn(async () => 1),
    getAuthClientSecretCiphertext: vi.fn(async () => 'auth-cipher'),
    getTenantAdminClientSecretCiphertext: vi.fn(async () => 'tenant-admin-cipher'),
    resolveHostname: vi.fn(async () => baseInstance),
    resolvePrimaryHostname: vi.fn(async () => baseInstance),
    listProvisioningRuns: vi.fn(async () => [latestRun]),
    listLatestProvisioningRuns: vi.fn(async () => ({ demo: latestRun })),
    listAuditEvents: vi.fn(async () => []),
    getLatestTenantIamAccessProbe: vi.fn(async () => null),
    getRoleReconcileSummary: vi.fn(async () => null),
    listKeycloakProvisioningRuns: vi.fn(async () => []),
    getKeycloakProvisioningRun: vi.fn(async () => null),
    claimNextKeycloakProvisioningRun: vi.fn(async () => null),
    prepareConfirmationChallenge: vi.fn(async () => ({
      challengeId: 'challenge-1',
      instanceId: 'demo',
      actorId: 'actor-1',
      actionId: 'instance.status.archive',
      moduleId: undefined,
      stateFingerprint: 'state-1',
      expiresAt: '2026-01-01T00:05:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
    consumeConfirmationChallenge: vi.fn(async () => true),
    createInstance: vi.fn(async () => baseInstance),
    updateInstance: vi.fn(async () => ({ ...baseInstance, displayName: 'Updated' })),
    setInstanceStatus: vi.fn(async () => ({ ...baseInstance, status: 'active' as const })),
    createProvisioningRun: vi.fn(async () => latestRun),
    retryProvisioningRun: vi.fn(async () => ({
      ...latestRun,
      status: 'requested' as const,
      stepKey: 'registry',
    })),
    appendAuditEvent: vi.fn(async () => undefined),
    createKeycloakProvisioningRun: vi.fn(async () => ({
      created: true,
      run: {
        id: 'keycloak-run-1',
        instanceId: 'demo',
        mode: 'new',
        intent: 'provision',
        overallStatus: 'planned',
        driftSummary: 'Planned',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        steps: [],
      },
    })),
    updateKeycloakProvisioningRun: vi.fn(async () => null),
    appendKeycloakProvisioningStep: vi.fn(async () => ({
      stepKey: 'status_snapshot',
      title: 'Status',
      status: 'done',
      summary: 'Done',
      details: {},
    })),
    ...overrides,
  }) as InstanceRegistryRepository;

const createDeps = (
  repository = createRepository(),
  overrides: Partial<InstanceRegistryServiceDeps> = {}
): InstanceRegistryServiceDeps => ({
  repository,
  invalidateHost: vi.fn(),
  invalidatePermissionSnapshots: vi.fn(async () => undefined),
  isAutomatedTenantProvisioningEnabled: vi.fn(() => true),
  protectSecret: vi.fn((value, aad) => (value ? `protected:${aad}:${value}` : null)),
  revealSecret: vi.fn((value) => (value ? `revealed:${value}` : undefined)),
  loadWasteDataSourceRecord: vi.fn(async () => null),
  saveWasteDataSourceRecord: vi.fn(async () => undefined),
  moduleIamRegistry: new Map([
    [
      'categories',
      {
        moduleId: 'categories',
        ownerPluginId: 'categories',
        permissionIds: [
          'categories.read',
          'categories.create',
          'categories.update',
          'categories.delete',
        ],
        systemRoles: [
          {
            roleName: 'system_admin',
            permissionIds: [
              'categories.read',
              'categories.create',
              'categories.update',
              'categories.delete',
            ],
          },
        ],
      },
    ],
    [
      'news',
      {
        moduleId: 'news',
        ownerPluginId: 'news',
        permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
        systemRoles: [
          {
            roleName: 'system_admin',
            permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
          },
        ],
      },
    ],
    [
      'events',
      {
        moduleId: 'events',
        ownerPluginId: 'events',
        permissionIds: ['events.read'],
        systemRoles: [{ roleName: 'system_admin', permissionIds: ['events.read'] }],
      },
    ],
    [
      'waste-management',
      {
        moduleId: 'waste-management',
        ownerPluginId: 'waste-management',
        permissionIds: [
          'waste-management.read',
          'waste-management.master-data.manage',
          'waste-management.tours.manage',
          'waste-management.scheduling.manage',
          'waste-management.import.execute',
          'waste-management.export.execute',
          'waste-management.seed.execute',
          'waste-management.reset.execute',
          'waste-management.settings.manage',
        ],
        systemRoles: [
          {
            roleName: 'system_admin',
            permissionIds: [
              'waste-management.read',
              'waste-management.master-data.manage',
              'waste-management.tours.manage',
              'waste-management.scheduling.manage',
              'waste-management.import.execute',
              'waste-management.export.execute',
              'waste-management.seed.execute',
              'waste-management.reset.execute',
              'waste-management.settings.manage',
            ],
          },
        ],
      },
    ],
  ]),
  ...overrides,
});

describe('instance registry service facade', () => {
  it('records confirmation attempts without confirmation secrets', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService(createDeps(repository));

    await service.recordConfirmationAttempt({
      instanceId: 'demo',
      actorId: 'service-account',
      actionId: 'instance.secret.rotate',
      outcome: 'rejected',
      reason: 'invalid_confirmation',
      requestId: 'req-confirm',
    });

    expect(repository.appendAuditEvent).toHaveBeenCalledWith({
      instanceId: 'demo',
      eventType: 'instance_confirmation_rejected',
      actorId: 'service-account',
      requestId: 'req-confirm',
      details: {
        actionId: 'instance.secret.rotate',
        outcome: 'rejected',
        reason: 'invalid_confirmation',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists instances with latest provisioning run summaries', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(service.listInstances({ search: 'Demo', status: 'requested' })).resolves.toEqual([
      expect.objectContaining({
        instanceId: 'demo',
        latestProvisioningRun: latestRun,
      }),
    ]);

    expect(repository.listInstances).toHaveBeenCalledWith({ search: 'Demo', status: 'requested' });
    expect(repository.listLatestProvisioningRuns).toHaveBeenCalledWith(['demo']);
  });

  it('builds a single-instance audit run with explicit checks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch);

    const repository = createRepository({
      countLocalSystemAdminAssignments: vi.fn(async () => 2),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        getKeycloakStatus: vi.fn(async () => ({
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          systemAdminRoleExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: true,
          runtimeSecretSource: 'tenant',
        })),
      })
    );

    await expect(
      service.runInstanceAudit({
        instanceIds: ['demo'],
        includeOnlyActive: false,
        actorId: 'actor-1',
        requestId: 'req-audit-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        actorId: 'actor-1',
        requestId: 'req-audit-1',
        includeOnlyActive: false,
        overallStatus: 'fail',
        checks: expect.arrayContaining([
          expect.objectContaining({
            checkId: 'run.targets.present',
            status: 'pass',
          }),
        ]),
        instances: [
          expect.objectContaining({
            instanceId: 'demo',
            overallStatus: 'fail',
            checks: expect.arrayContaining([
              expect.objectContaining({
                checkId: 'instance.url.reachable',
                status: 'pass',
              }),
              expect.objectContaining({
                checkId: 'registry.instance.active',
                status: 'fail',
              }),
              expect.objectContaining({
                checkId: 'keycloak.role.systemAdmin.exists',
                status: 'pass',
              }),
              expect.objectContaining({
                checkId: 'localIam.systemAdminAssignment.exists',
                actual: '2 aktive Zuordnungen',
              }),
            ]),
          }),
        ],
      })
    );
  });

  it('marks dependent keycloak checks as skipped when the realm cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch);

    const service = createInstanceRegistryService(
      createDeps(createRepository(), {
        getKeycloakStatus: vi.fn(async () => {
          throw new Error('keycloak unavailable');
        }),
      })
    );

    const result = await service.runInstanceAudit({
      instanceIds: ['demo'],
      includeOnlyActive: false,
    });

    expect(result.instances[0]?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'keycloak.access.read',
          status: 'warn',
          actual: 'KEYCLOAK_STATUS_UNAVAILABLE',
          details: expect.objectContaining({
            primaryEvidenceSource: 'keycloak_live',
            secondaryEvidenceSource: 'keycloak_snapshot',
          }),
        }),
        expect.objectContaining({
          checkId: 'keycloak.realm.exists',
          status: 'warn',
          actual: 'live_nicht_verifiziert',
        }),
        expect.objectContaining({
          checkId: 'keycloak.client.login.exists',
          status: 'skip',
        }),
      ])
    );
  });

  it('supports running the audit without an explicit input object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch);

    const service = createInstanceRegistryService(
      createDeps(createRepository(), {
        getKeycloakStatus: vi.fn(async () => ({
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          systemAdminRoleExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: true,
          runtimeSecretSource: 'tenant',
        })),
      })
    );

    const result = await service.runInstanceAudit();
    expect(result.includeOnlyActive).toBe(true);
    expect(result.targetInstanceIds).toEqual(['demo']);
  });

  it('fails the run check when no active target instances can be resolved', async () => {
    const repository = createRepository({
      listInstances: vi.fn(async () => []),
      getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'archived' as const })),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    const fromList = await service.runInstanceAudit();
    expect(fromList.overallStatus).toBe('fail');
    expect(fromList.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'run.targets.present',
          status: 'fail',
          actual: '0 Instanzen',
        }),
      ])
    );

    const fromRequestedIds = await service.runInstanceAudit({
      instanceIds: ['demo'],
      includeOnlyActive: true,
    });
    expect(fromRequestedIds.instances).toEqual([]);
    expect(fromRequestedIds.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'run.targets.present',
          status: 'fail',
        }),
      ])
    );
  });

  it('rejects duplicate create requests before mutating state', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => baseInstance),
      createInstance: vi.fn(async () => baseInstance),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'Studio.Example.Org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'other-request',
      })
    ).resolves.toEqual({ ok: false, reason: 'already_exists' });
    expect(repository.createInstance).not.toHaveBeenCalled();
  });

  it.each(['studio', 'auth', 'admin'])(
    'rejects reserved host %s before creating a tenant',
    async (instanceId) => {
      const repository = createRepository();
      const service = createInstanceRegistryService(
        createDeps(repository, {
          reservedHostnames: () => ['ADMIN.STUDIO.EXAMPLE.ORG'],
        })
      );
      await expect(
        service.createProvisioningRequest({
          instanceId,
          displayName: 'Demo',
          parentDomain: 'studio.example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'studio-client',
          idempotencyKey: 'reserved',
        })
      ).rejects.toThrow('tenant_hostname_reserved');
      expect(repository.getInstanceById).not.toHaveBeenCalled();
      expect(repository.createInstance).not.toHaveBeenCalled();
    }
  );

  it('rejects a domain update that would collide with the configured root', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService(
      createDeps(repository, {
        reservedHostnames: ['demo.other.example.org'],
      })
    );
    await expect(
      service.updateInstance({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'other.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'studio-client',
      })
    ).rejects.toThrow('tenant_hostname_reserved');
    expect(repository.updateInstance).not.toHaveBeenCalled();
  });

  it('rejects dynamically reserved OIDC client ids at the service mutation boundary', async () => {
    const repository = createRepository();
    const reservedOidcClientIds = vi.fn(() => ['ssf']);
    const service = createInstanceRegistryService(
      createDeps(repository, { reservedOidcClientIds })
    );

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'ssf',
        idempotencyKey: 'idem-reserved-create',
      })
    ).rejects.toThrow('oidc_client_id_reserved');
    await expect(
      service.updateInstance({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'studio-client',
        tenantAdminClient: { clientId: 'ssf' },
      })
    ).rejects.toThrow('oidc_client_id_reserved');

    expect(reservedOidcClientIds).toHaveBeenCalledTimes(2);
    expect(repository.getInstanceById).not.toHaveBeenCalled();
    expect(repository.createInstance).not.toHaveBeenCalled();
    expect(repository.updateInstance).not.toHaveBeenCalled();
  });

  it('resumes policy reconciliation for an idempotent create retry', async () => {
    const reconcileModuleActivationPolicies = vi.fn(async () => ({
      changedModuleIds: [],
      conflictModuleIds: [],
      unchangedModuleIds: ['news'],
    }));
    const repository = createRepository({
      getInstanceById: vi.fn(async () => idempotentInstance),
      listProvisioningRuns: vi.fn(async () => [latestRun]),
      reconcileModuleActivationPolicies,
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        pluginTenantLifecycleRegistry: new Map([
          ['news', { pluginId: 'news', contractRevision: 'news-1:1' }],
        ]),
        readModuleActivationPolicySnapshot: () => ({
          revision: 'catalog-1',
          modules: [
            {
              moduleId: 'news',
              activationPolicy: 'automatic',
              manifestVersion: 1,
              policyRevision: 'news-1',
            },
          ],
        }),
      })
    );

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(reconcileModuleActivationPolicies).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'demo', reconcileId: 'catalog-1' })
    );
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'demo' })
    );
    expect(repository.persistPluginTenantLifecycleReconcileIntents).toHaveBeenCalledWith({
      instanceId: 'demo',
      lifecycles: [{ pluginId: 'news', contractRevision: 'news-1:1' }],
      forcePluginIds: [],
    });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_module_policy_reconciled',
        details: expect.objectContaining({ lifecycleIntents: ['news'] }),
      })
    );
    expect(repository.createInstance).not.toHaveBeenCalled();
  });

  it('resolves a concurrent identical create after losing the instance insert race', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(idempotentInstance),
      createInstance: vi.fn(async () => null),
      listProvisioningRuns: vi.fn(async () => [latestRun]),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(repository.createInstance).toHaveBeenCalledTimes(1);
    expect(repository.listProvisioningRuns).toHaveBeenCalledWith('demo');
  });

  it('waits for the winning create request to persist its idempotency evidence', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(idempotentInstance),
      createInstance: vi.fn(async () => null),
      listProvisioningRuns: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([latestRun]),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(repository.listProvisioningRuns).toHaveBeenCalledTimes(2);
  });

  it('rejects an idempotency key reused with a different create payload', async () => {
    const reconcileModuleActivationPolicies = vi.fn();
    const repository = createRepository({
      getInstanceById: vi.fn(async () => baseInstance),
      listProvisioningRuns: vi.fn(async () => [latestRun]),
      reconcileModuleActivationPolicies,
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Changed display name',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).rejects.toThrow('idempotency_key_reuse');

    expect(reconcileModuleActivationPolicies).not.toHaveBeenCalled();
    expect(repository.createInstance).not.toHaveBeenCalled();
  });

  it('rejects a create retry when its submitted secret differs from encrypted registry state', async () => {
    const getAuthClientSecretCiphertext = vi.fn(async () => 'auth-cipher');
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
      })),
      getAuthClientSecretCiphertext,
      listProvisioningRuns: vi.fn(async () => [latestRunWithAuthSecret]),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        revealSecret: vi.fn((value) => (value === 'auth-cipher' ? 'original-secret' : undefined)),
      })
    );

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        authClientSecret: 'different-secret',
        idempotencyKey: 'idem-1',
      })
    ).rejects.toThrow('idempotency_key_reuse');

    expect(getAuthClientSecretCiphertext).toHaveBeenCalledWith('demo');
  });

  it('accepts a create retry when its submitted secret matches encrypted registry state', async () => {
    const getAuthClientSecretCiphertext = vi.fn(async () => 'auth-cipher');
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        tenantAdminClient: { clientId: 'tenant-admin', secretConfigured: false },
      })),
      getAuthClientSecretCiphertext,
      listProvisioningRuns: vi.fn(async () => [latestRunWithAuthSecret]),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        revealSecret: vi.fn((value) => (value === 'auth-cipher' ? 'original-secret' : undefined)),
      })
    );

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        authClientSecret: ' original-secret ',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(getAuthClientSecretCiphertext).toHaveBeenCalledWith('demo');
  });

  it('accepts an unchanged create retry after provisioning generated omitted secrets', async () => {
    const getAuthClientSecretCiphertext = vi.fn();
    const getTenantAdminClientSecretCiphertext = vi.fn();
    const repository = createRepository({
      getInstanceById: vi.fn(async () => baseInstance),
      getAuthClientSecretCiphertext,
      getTenantAdminClientSecretCiphertext,
      listProvisioningRuns: vi.fn(async () => [latestRun]),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(getAuthClientSecretCiphertext).not.toHaveBeenCalled();
    expect(getTenantAdminClientSecretCiphertext).not.toHaveBeenCalled();
  });

  it('rejects a create retry when legacy evidence has no payload fingerprint', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => baseInstance),
      listProvisioningRuns: vi.fn(async () => [{ ...latestRun, payloadFingerprint: undefined }]),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).rejects.toThrow('idempotency_key_reuse');
  });

  it('requeues a terminally failed parent run with the same idempotent create request', async () => {
    const failedInstance = { ...baseInstance, status: 'failed' as const };
    const failedRun = {
      ...latestRun,
      status: 'failed' as const,
      stepKey: 'login',
      errorCode: 'kassel_login_probe_failed',
      completedAt: '2026-01-01T00:10:00.000Z',
    };
    const retryProvisioningRun = vi.fn(async () => ({
      ...failedRun,
      status: 'requested' as const,
      stepKey: 'registry',
      errorCode: undefined,
      completedAt: undefined,
    }));
    const repository = createRepository({
      getInstanceById: vi.fn(async () => failedInstance),
      listProvisioningRuns: vi.fn(async () => [failedRun]),
      retryProvisioningRun,
      setInstanceStatus: vi.fn(async () => ({
        ...failedInstance,
        status: 'requested' as const,
      })),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        status: 'requested',
        latestProvisioningRun: expect.objectContaining({ stepKey: 'registry' }),
      }),
    });
    expect(retryProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'demo', idempotencyKey: 'idem-1' })
    );
  });

  it('creates requested instances, protects secrets and invalidates the primary host', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'Studio.Example.Org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        authClientSecret: ' auth-secret ',
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secret: ' tenant-secret ',
        },
        tenantAdminBootstrap: {
          username: 'tenant-admin',
        },
        idempotencyKey: 'idem-1',
        actorId: 'actor-1',
        requestId: 'request-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        instanceId: 'demo',
        primaryHostname: 'demo.studio.example.org',
      }),
    });

    expect(repository.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        authClientSecretCiphertext: 'protected:iam.instances.auth_client_secret:demo:auth-secret',
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretCiphertext: 'protected:iam.instances.tenant_admin_client_secret:demo:tenant-secret',
        },
      })
    );
    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'create', status: 'requested' })
    );
    expect(deps.invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
  });

  it('does not advertise automated provisioning when the environment mode is external', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(baseInstance),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, { isAutomatedTenantProvisioningEnabled: () => false })
    );

    const result = await service.createProvisioningRequest({
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'dialog.kassel.de',
      realmMode: 'existing',
      authRealm: 'smartcity',
      authClientId: 'studio-client',
      idempotencyKey: 'idem-external',
    });

    expect(result.ok && result.instance.latestProvisioningRun).toBeUndefined();
    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        desiredSnapshot: expect.objectContaining({ automationMode: 'external' }),
      })
    );
  });

  it('persists the environment-resolved public issuer in the create snapshot', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
    });
    const resolveProvisioningAuthIssuerUrl = vi.fn(
      () => 'https://auth.dialog.kassel.de/realms/smartcity'
    );
    const service = createInstanceRegistryService(
      createDeps(repository, { resolveProvisioningAuthIssuerUrl })
    );

    await service.createProvisioningRequest({
      instanceId: 'new-tenant',
      displayName: 'Neuer Mandant',
      parentDomain: 'dialog.kassel.de',
      realmMode: 'existing',
      authRealm: 'smartcity',
      authClientId: 'sva-studio-login',
      idempotencyKey: 'idem-kassel-1',
    });

    expect(resolveProvisioningAuthIssuerUrl).toHaveBeenCalledWith({
      parentDomain: 'dialog.kassel.de',
      authRealm: 'smartcity',
      authIssuerUrl: undefined,
    });
    expect(repository.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        authIssuerUrl: 'https://auth.dialog.kassel.de/realms/smartcity',
      })
    );
    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadFingerprint: buildCreateInstancePayloadFingerprint({
          instanceId: 'new-tenant',
          displayName: 'Neuer Mandant',
          parentDomain: 'dialog.kassel.de',
          realmMode: 'existing',
          authRealm: 'smartcity',
          authClientId: 'sva-studio-login',
          authIssuerUrl: 'https://auth.dialog.kassel.de/realms/smartcity',
          idempotencyKey: 'idem-kassel-1',
        }),
      })
    );
  });

  it.each([
    [
      'registry_lookup',
      {
        getInstanceById: vi.fn(async () => {
          throw new Error('lookup secret');
        }),
      },
      undefined,
    ],
    [
      'registry_insert',
      {
        getInstanceById: vi.fn(async () => null),
        createInstance: vi.fn(async () => {
          throw new Error('insert secret');
        }),
      },
      undefined,
    ],
    [
      'provisioning_run_insert',
      {
        getInstanceById: vi.fn(async () => null),
        createProvisioningRun: vi.fn(async () => {
          throw new Error('run secret');
        }),
      },
      undefined,
    ],
    [
      'audit_event_insert',
      {
        getInstanceById: vi.fn(async () => null),
        appendAuditEvent: vi.fn(async () => {
          throw new Error('audit secret');
        }),
      },
      undefined,
    ],
    [
      'host_cache_invalidate',
      { getInstanceById: vi.fn(async () => null) },
      vi.fn(() => {
        throw new Error('cache secret');
      }),
    ],
  ] as const)('annotates create failures at %s', async (stepKey, overrides, invalidateHost) => {
    const repository = createRepository(overrides);
    const deps = createDeps(repository);
    if (invalidateHost) deps.invalidateHost = invalidateHost;
    const service = createInstanceRegistryService(deps);

    const result = service.createProvisioningRequest({
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'studio-client',
      idempotencyKey: 'idem-errors',
    });
    await expect(result).rejects.toMatchObject({ instanceRegistryStep: stepKey });
  });

  it('does not persist legacy waste-management settings during create', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await service.createProvisioningRequest({
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'Studio.Example.Org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'studio-client',
      idempotencyKey: 'idem-1',
    });

    expect(deps.saveWasteDataSourceRecord).not.toHaveBeenCalled();
  });

  it('defaults the tenant admin client id on create when the form does not submit one', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ instanceId: 'demo' }),
    });

    expect(repository.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretCiphertext: undefined,
        },
      })
    );
  });

  it('handles status transitions and emits status artifacts', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'suspended' as const })),
      setInstanceStatus: vi.fn(async () => ({ ...baseInstance, status: 'active' as const })),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.changeStatus({
        instanceId: 'demo',
        nextStatus: 'active',
        idempotencyKey: 'idem-activate',
        actorId: 'actor-1',
        requestId: 'request-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ status: 'active' }),
    });

    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'activate', status: 'active' })
    );
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_activated',
        details: { previousStatus: 'suspended', nextStatus: 'active' },
      })
    );
    expect(deps.invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
  });

  it('returns status errors for missing or invalid transitions', async () => {
    await expect(
      createInstanceRegistryService(
        createDeps(createRepository({ getInstanceById: vi.fn(async () => null) }))
      ).changeStatus({
        instanceId: 'missing',
        nextStatus: 'active',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'not_found' });

    await expect(
      createInstanceRegistryService(
        createDeps(
          createRepository({
            getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'active' as const })),
          })
        )
      ).changeStatus({
        instanceId: 'demo',
        nextStatus: 'active',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({ status: 'active' }),
    });

    await expect(
      createInstanceRegistryService(
        createDeps(
          createRepository({
            getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'archived' as const })),
          })
        )
      ).changeStatus({
        instanceId: 'demo',
        nextStatus: 'active',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'invalid_transition', currentStatus: 'archived' });
  });

  it('preserves a registered hostname that differs from the immutable tenant id', async () => {
    const existing = {
      ...baseInstance,
      instanceId: 'tenant-kassel',
      parentDomain: 'dialog.kassel.de',
      primaryHostname: 'smartcity.dialog.kassel.de',
    };
    const repository = createRepository({
      getInstanceById: vi.fn(async () => existing),
      updateInstance: vi.fn(async () => existing),
    });
    await createInstanceRegistryService(createDeps(repository)).updateInstance({
      instanceId: 'tenant-kassel',
      displayName: 'Kassel',
      parentDomain: 'Dialog.Kassel.de',
      realmMode: 'existing',
      authRealm: 'sva-studio',
      authClientId: 'tenant-client',
    });
    expect(repository.updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-kassel',
        primaryHostname: 'smartcity.dialog.kassel.de',
      })
    );
  });

  it('blocks configuration changes while automated tenant provisioning is active', async () => {
    const repository = createRepository({
      listProvisioningRuns: vi.fn(async () => [
        {
          ...latestRun,
          desiredSnapshot: { automationMode: 'kassel-traefik-file' },
        },
      ]),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.updateInstance({
        instanceId: 'demo',
        displayName: 'Changed during provisioning',
        parentDomain: baseInstance.parentDomain,
        realmMode: baseInstance.realmMode,
        authRealm: baseInstance.authRealm,
        authClientId: baseInstance.authClientId,
      })
    ).rejects.toThrow('instance_configuration_change_blocked');
    expect(repository.updateInstance).not.toHaveBeenCalled();
  });

  it('updates instances and returns detail projections', async () => {
    const updated = {
      ...baseInstance,
      displayName: 'Updated',
      parentDomain: 'example.org',
      primaryHostname: 'demo.example.org',
    };
    const repository = createRepository({
      getInstanceById: vi.fn().mockResolvedValueOnce(baseInstance).mockResolvedValue(updated),
      updateInstance: vi.fn(async () => updated),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.updateInstance({
        instanceId: 'demo',
        displayName: 'Updated',
        parentDomain: 'Example.Org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'studio-client',
        tenantAdminClient: {
          clientId: 'tenant-admin',
        },
        actorId: 'actor-1',
        requestId: 'request-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        displayName: 'Updated',
        hostnames: [
          { hostname: 'demo.example.org', isPrimary: true, createdAt: baseInstance.createdAt },
        ],
      })
    );

    expect(repository.updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDomain: 'example.org',
        primaryHostname: 'demo.example.org',
        keepExistingAuthClientSecret: true,
        keepExistingTenantAdminClientSecret: true,
        tenantAdminBootstrap: baseInstance.tenantAdminBootstrap,
      })
    );
    expect(deps.invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
    expect(deps.invalidateHost).toHaveBeenCalledWith('demo.example.org');
  });

  it('does not update the legacy waste datasource during instance updates', async () => {
    const updated = {
      ...baseInstance,
      displayName: 'Updated',
      parentDomain: 'example.org',
      primaryHostname: 'demo.example.org',
    };
    const repository = createRepository({
      getInstanceById: vi.fn().mockResolvedValueOnce(baseInstance).mockResolvedValue(updated),
      updateInstance: vi.fn(async () => updated),
    });
    const deps = createDeps(repository, {
      loadWasteDataSourceRecord: vi.fn(async () => ({
        instanceId: 'demo',
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'public',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        databaseUrlCiphertext: 'existing-db-cipher',
        serviceRoleKeyCiphertext: 'existing-service-cipher',
        visibleStatus: 'ok',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'succeeded',
      })),
    });

    await createInstanceRegistryService(deps).updateInstance({
      instanceId: 'demo',
      displayName: 'Updated',
      parentDomain: 'Example.Org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'studio-client',
    });

    expect(deps.saveWasteDataSourceRecord).not.toHaveBeenCalled();
  });

  it('returns null when updating a missing instance', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
      updateInstance: vi.fn(async () => baseInstance),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).updateInstance({
        instanceId: 'missing',
        displayName: 'Missing',
        parentDomain: 'example.org',
        realmMode: 'new',
        authRealm: 'missing',
        authClientId: 'studio-client',
      })
    ).resolves.toBeNull();
    expect(repository.updateInstance).not.toHaveBeenCalled();
  });

  it('builds tenant IAM status into instance detail projections from repository evidence', async () => {
    const repository = createRepository({
      listAuditEvents: vi.fn(async () => []),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
      getLatestTenantIamAccessProbe: vi.fn(async () => ({
        checkedAt: '2026-04-29T10:01:00.000Z',
        status: 'blocked',
        summary: 'Tenant-Admin-Client darf Rollen nicht lesen.',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-probe-1',
      })),
      getRoleReconcileSummary: vi.fn(async () => ({
        checkedAt: '2026-04-29T10:00:00.000Z',
        status: 'degraded',
        summary: 'Ein Rollenabgleich ist mit Drift beendet worden.',
        errorCode: 'IDP_CONFLICT',
        requestId: 'req-reconcile-1',
      })),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService({
      ...deps,
      getKeycloakStatus: vi.fn(async () => ({
        realmExists: true,
        clientExists: true,
        tenantAdminClientExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        tenantAdminClientSecretConfigured: true,
        tenantAdminClientSecretReadable: true,
        tenantAdminClientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      })),
    });

    await expect(service.getInstanceDetail('demo')).resolves.toEqual(
      expect.objectContaining({
        assignedModules: ['news'],
        wasteManagementSettings: undefined,
        moduleIamStatus: expect.objectContaining({
          overall: expect.objectContaining({ status: 'ready' }),
          modules: [
            expect.objectContaining({
              moduleId: 'news',
              status: 'ready',
            }),
          ],
        }),
        tenantIamStatus: expect.objectContaining({
          access: expect.objectContaining({
            status: 'blocked',
            requestId: 'req-probe-1',
          }),
          reconcile: expect.objectContaining({
            status: 'degraded',
            requestId: 'req-reconcile-1',
          }),
          overall: expect.objectContaining({
            status: 'blocked',
            requestId: 'req-probe-1',
          }),
        }),
      })
    );
  });

  it('projects waste-management settings into instance detail when a datasource is configured', async () => {
    const repository = createRepository({
      listAuditEvents: vi.fn(async () => []),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        loadWasteDataSourceRecord: vi.fn(async () => ({
          instanceId: 'demo',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
          enabled: true,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: false,
          visibleStatus: 'error',
          lastCheckedAt: '2026-05-09T10:00:00.000Z',
          lastCheckStatus: 'failed',
          lastCheckErrorCode: 'connection_refused',
          lastCheckErrorMessage: 'Host unreachable',
        })),
      })
    );

    await expect(service.getInstanceDetail('demo')).resolves.toEqual(
      expect.objectContaining({
        wasteManagementSettings: expect.objectContaining({
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          visibleStatus: 'error',
          lastCheckStatus: 'failed',
          lastCheckErrorCode: 'connection_refused',
        }),
      })
    );
  });

  it('keeps instance detail available when waste-management settings cannot be loaded', async () => {
    const repository = createRepository({
      listAuditEvents: vi.fn(async () => []),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        loadWasteDataSourceRecord: vi.fn(async () => {
          throw new Error('relation "iam.instance_waste_data_sources" does not exist');
        }),
      })
    );

    await expect(service.getInstanceDetail('demo')).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        wasteManagementSettings: undefined,
      })
    );
  });

  it('probes tenant IAM access, persists audit evidence and returns the updated status', async () => {
    const repository = createRepository({
      appendAuditEvent: vi.fn(async () => undefined),
      getLatestTenantIamAccessProbe: vi.fn(async () => null),
      getRoleReconcileSummary: vi.fn(async () => null),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService({
      ...deps,
      probeTenantIamAccess: vi.fn(async () => ({
        status: 'ready',
        summary: 'Tenant-Admin-Client kann Realm-Rollen lesen.',
        checkedAt: '2026-04-29T10:15:00.000Z',
        source: 'access_probe',
        requestId: 'req-probe-1',
      })),
    });

    await expect(
      service.probeTenantIamAccess({
        instanceId: 'demo',
        actorId: 'actor-1',
        requestId: 'req-probe-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        access: expect.objectContaining({
          status: 'ready',
          requestId: 'req-probe-1',
        }),
        overall: expect.objectContaining({
          status: 'degraded',
        }),
      })
    );

    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        eventType: 'tenant_iam_access_probed',
        actorId: 'actor-1',
        requestId: 'req-probe-1',
        details: expect.objectContaining({
          status: 'ready',
          summary: 'Tenant-Admin-Client kann Realm-Rollen lesen.',
          requestId: 'req-probe-1',
        }),
      })
    );
  });

  it('assigns a module, syncs IAM baseline and returns the refreshed detail', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['categories', 'events', 'news']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({
          ...baseInstance,
          assignedModules: ['categories', 'events', 'news'],
        }),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        pluginTenantLifecycleRegistry: new Map([
          ['events', { pluginId: 'events', contractRevision: 'events-1:1' }],
        ]),
      })
    );

    await expect(
      service.assignModule({
        instanceId: 'demo',
        moduleId: 'events',
        idempotencyKey: 'idem-module-1',
        actorId: 'actor-1',
        requestId: 'req-module-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: ['categories', 'events', 'news'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events', 'events-1:1');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: expect.arrayContaining([
          'categories',
          'news',
          'events',
          'waste-management',
        ]),
        contracts: expect.arrayContaining([
          expect.objectContaining({ moduleId: 'categories' }),
          expect.objectContaining({ moduleId: 'news' }),
          expect.objectContaining({ moduleId: 'events' }),
        ]),
      })
    );
    expect(repository.persistPluginTenantLifecycleReconcileIntents).toHaveBeenCalledWith({
      instanceId: 'demo',
      lifecycles: [{ pluginId: 'events', contractRevision: 'events-1:1' }],
      forcePluginIds: [],
    });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_module_assigned',
        details: expect.objectContaining({
          moduleId: 'events',
          outcome: 'assigned',
        }),
      })
    );
  });

  it('assigns the waste-management module and syncs its permission contract into instance IAM', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['news', 'waste-management']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['news', 'waste-management'] }),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.assignModule({
        instanceId: 'demo',
        moduleId: 'waste-management',
        idempotencyKey: 'idem-module-waste-1',
        actorId: 'actor-1',
        requestId: 'req-module-waste-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: ['news', 'waste-management'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'waste-management');
    expect(repository.requestWasteProvisioning).toHaveBeenCalledWith('demo');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: ['categories', 'news', 'events', 'waste-management'],
        contracts: expect.arrayContaining([
          expect.objectContaining({ moduleId: 'news' }),
          expect.objectContaining({
            moduleId: 'waste-management',
            permissionIds: expect.arrayContaining([
              'waste-management.read',
              'waste-management.settings.manage',
              'waste-management.reset.execute',
            ]),
          }),
        ]),
      })
    );
  });

  it('bootstraps the editable admin structure and assigns selected modules first', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['categories', 'events', 'news']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({
          ...baseInstance,
          assignedModules: ['categories', 'events', 'news'],
        }),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        pluginTenantLifecycleRegistry: new Map([
          ['events', { pluginId: 'events', contractRevision: 'events-1:1' }],
        ]),
      })
    );

    await expect(
      service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-1',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: ['categories', 'events', 'news'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledTimes(2);
    expect(repository.assignModule).toHaveBeenNthCalledWith(1, 'demo', 'categories');
    expect(repository.assignModule).toHaveBeenNthCalledWith(2, 'demo', 'events', 'events-1:1');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: expect.arrayContaining([
          'categories',
          'news',
          'events',
          'waste-management',
        ]),
      })
    );
    expect(repository.syncProtectedSystemRolePermissions).toHaveBeenCalledWith({
      instanceId: 'demo',
      role: expect.objectContaining({
        roleKey: 'system_admin',
        roleLevel: 100,
        permissions: expect.arrayContaining([
          expect.objectContaining({ key: 'iam.user.read' }),
          expect.objectContaining({ key: 'iam.user.write' }),
          expect.objectContaining({ key: 'iam.role.read' }),
          expect.objectContaining({ key: 'iam.role.write' }),
          expect.objectContaining({ key: 'app.read' }),
          expect.objectContaining({ key: 'cockpit.read' }),
          expect.objectContaining({ key: 'iam.accounts.delete' }),
        ]),
      }),
    });
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_admin_bootstrapped',
        details: expect.objectContaining({
          assignedModules: ['categories', 'events', 'news'],
          bootstrapMode: 'system_admin_only',
        }),
      })
    );
  });

  it('keeps successfully assigned modules when admin bootstrap role sync fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['news']),
      syncProtectedSystemRolePermissions: vi.fn(async () => {
        throw new Error('admin_bootstrap_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news'],
        idempotencyKey: 'idem-bootstrap-2',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-2',
      })
    ).rejects.toThrow('admin_bootstrap_failed');

    expect(repository.assignModule).toHaveBeenCalledTimes(1);
    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'categories');
    expect(repository.revokeModule).not.toHaveBeenCalled();
    expect(repository.syncAssignedModuleIam).toHaveBeenCalled();
    expect(deps.invalidatePermissionSnapshots).toHaveBeenCalledWith({
      instanceId: 'demo',
      trigger: 'instance_module_assigned',
    });
    expect(repository.appendAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_admin_bootstrapped',
      })
    );
  });

  it('continues bootstrapping when a requested module was assigned concurrently', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => false),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['news', 'events']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['news', 'events'] }),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-race-1',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-race-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: ['news', 'events'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({ moduleId: 'news' }),
          expect.objectContaining({ moduleId: 'events' }),
        ]),
      })
    );
    expect(repository.syncProtectedSystemRolePermissions).toHaveBeenCalled();
  });

  it('rolls back newly assigned modules when bootstrap module IAM sync fails', async () => {
    const repository = createRepository({
      getModuleActivationPolicy: vi.fn(async () => null),
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      restoreModuleActivation: vi.fn(async () => true),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-rollback-1',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-rollback-1',
      })
    ).rejects.toThrow('sync_failed');

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.restoreModuleActivation).toHaveBeenCalledWith('demo', 'events', null);
    expect(repository.revokeModule).not.toHaveBeenCalled();
    expect(repository.syncProtectedSystemRolePermissions).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
    expect(deps.invalidatePermissionSnapshots).not.toHaveBeenCalled();
  });

  it('restores an existing inactive activation after bootstrap IAM sync fails', async () => {
    const inactiveState = {
      activationPolicy: 'automatic' as const,
      activationOrigin: 'policy_reconcile' as const,
      effectiveActive: false,
      manualOverride: null,
      reconcileId: 'reconcile-1',
      reconciledAt: '2026-08-30T12:00:00.000Z',
      stateRevision: 7,
      updatedBy: 'system',
    };
    const repository = createRepository({
      getModuleActivationPolicy: vi.fn(async () => inactiveState),
      assignModule: vi.fn(async () => true),
      restoreModuleActivation: vi.fn(async () => true),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-existing-rollback',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-existing-rollback',
      })
    ).rejects.toThrow('sync_failed');

    expect(repository.restoreModuleActivation).toHaveBeenCalledWith(
      'demo',
      'events',
      inactiveState
    );
  });

  it('rolls back earlier bootstrap assignments when a later advisory lock conflicts', async () => {
    const repository = createRepository({
      getModuleActivationPolicy: vi.fn(async () => null),
      assignModule: vi.fn(async (_instanceId: string, moduleId: string) => {
        if (moduleId === 'events') {
          throw new Error('plugin_activation_state_conflict:events');
        }
        return true;
      }),
      restoreModuleActivation: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['news']),
      getInstanceById: vi.fn(async () => baseInstance),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-lock-conflict',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-lock-conflict',
      })
    ).rejects.toThrow('plugin_activation_state_conflict:events');

    expect(repository.restoreModuleActivation).toHaveBeenCalledWith('demo', 'categories', null);
    expect(repository.syncAssignedModuleIam).not.toHaveBeenCalled();
  });

  it('restores automatic activation state when IAM sync fails after a manual assignment', async () => {
    const automaticState = {
      activationPolicy: 'automatic' as const,
      activationOrigin: 'policy_reconcile' as const,
      effectiveActive: true,
      manualOverride: null,
      reconcileId: 'reconcile-1',
      reconciledAt: '2026-08-30T12:00:00.000Z',
      stateRevision: 7,
      updatedBy: 'system',
    };
    const repository = createRepository({
      getModuleActivationPolicy: vi.fn(async () => automaticState),
      assignModule: vi.fn(async () => true),
      restoreModuleActivation: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).assignModule({
        instanceId: 'demo',
        moduleId: 'events',
        idempotencyKey: 'idem-module-automatic-rollback',
        actorId: 'actor-1',
        requestId: 'req-module-automatic-rollback',
      })
    ).rejects.toThrow('sync_failed');

    expect(repository.restoreModuleActivation).toHaveBeenCalledWith(
      'demo',
      'events',
      automaticState
    );
    expect(repository.revokeModule).not.toHaveBeenCalled();
  });

  it('throws a bootstrap rollback error when reverting newly assigned modules also fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      restoreModuleActivation: vi.fn(async () => {
        throw new Error('rollback_failed');
      }),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    try {
      await service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-rollback-2',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-rollback-2',
      });
      expect.unreachable('bootstrapAdminStructure should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'instance_module_bootstrap_rollback_failed:demo:events:sync_failed'
      );
      expect((error as Error).name).toBe('InstanceModuleBootstrapRollbackError');
      expect((error as Error).cause).toEqual({
        syncError: expect.any(Error),
        rollbackError: expect.any(Error),
      });
      expect(((error as Error).cause as { syncError: Error }).syncError.message).toBe(
        'sync_failed'
      );
      expect(((error as Error).cause as { rollbackError: Error }).rollbackError.message).toBe(
        'rollback_failed'
      );
    }
  });

  it('throws a bootstrap rollback error when activation restoration reports no change', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      restoreModuleActivation: vi.fn(async () => false),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news'])
        .mockResolvedValueOnce(['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    try {
      await service.bootstrapAdminStructure({
        instanceId: 'demo',
        moduleIds: ['news', 'events'],
        idempotencyKey: 'idem-bootstrap-rollback-3',
        actorId: 'actor-1',
        requestId: 'req-bootstrap-rollback-3',
      });
      expect.unreachable('bootstrapAdminStructure should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'instance_module_bootstrap_rollback_failed:demo:events:sync_failed'
      );
      expect((error as Error).name).toBe('InstanceModuleBootstrapRollbackError');
      expect(((error as Error).cause as { rollbackError: Error }).rollbackError.message).toBe(
        'rollback_restore_failed:events'
      );
    }
  });

  it('invalidates instance permission snapshots after module IAM changes', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      restoreModuleActivation: vi.fn(async () => true),
      getInstanceById: vi.fn(async () => baseInstance),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news', 'events'])
        .mockResolvedValueOnce(['categories', 'events', 'news'])
        .mockResolvedValueOnce(['categories', 'events'])
        .mockResolvedValueOnce(['categories', 'events']),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await service.assignModule({
      instanceId: 'demo',
      moduleId: 'events',
      idempotencyKey: 'idem-module-1',
      actorId: 'actor-1',
      requestId: 'req-module-1',
    });

    await service.revokeModule({
      instanceId: 'demo',
      moduleId: 'news',
      confirmation: 'REVOKE',
      idempotencyKey: 'idem-module-2',
      actorId: 'actor-1',
      requestId: 'req-module-2',
    });

    await service.seedIamBaseline({
      instanceId: 'demo',
      idempotencyKey: 'idem-module-3',
      actorId: 'actor-1',
      requestId: 'req-module-3',
    });

    expect(repository.syncProtectedSystemRolePermissions).toHaveBeenCalledWith({
      instanceId: 'demo',
      role: expect.objectContaining({
        roleKey: 'system_admin',
        permissions: expect.arrayContaining([
          expect.objectContaining({ key: 'iam.user.read' }),
          expect.objectContaining({ key: 'content.read' }),
          expect.objectContaining({ key: 'app.read' }),
        ]),
      }),
    });
    expect(deps.invalidatePermissionSnapshots).toHaveBeenNthCalledWith(1, {
      instanceId: 'demo',
      trigger: 'instance_module_assigned',
    });
    expect(deps.invalidatePermissionSnapshots).toHaveBeenNthCalledWith(2, {
      instanceId: 'demo',
      trigger: 'instance_module_revoked',
    });
    expect(deps.invalidatePermissionSnapshots).toHaveBeenNthCalledWith(3, {
      instanceId: 'demo',
      trigger: 'instance_module_iam_seeded',
    });
  });

  it('assigns the host-owned media module when it is present in the module registry', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['media']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['media'] }),
    });
    const service = createInstanceRegistryService(
      createDeps(repository, {
        moduleIamRegistry: new Map([
          [
            'media',
            {
              moduleId: 'media',
              permissionIds: ['media.read', 'media.create'],
              systemAdminPermissionExclusions: ['media.create'],
            },
          ],
        ]),
      })
    );

    await expect(
      service.assignModule({
        instanceId: 'demo',
        moduleId: 'media',
        idempotencyKey: 'idem-module-media-1',
        actorId: 'actor-1',
        requestId: 'req-module-media-1',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: ['media'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'media');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: ['media'],
        contracts: [
          expect.objectContaining({
            moduleId: 'media',
            systemRoles: [{ roleName: 'system_admin', permissionIds: ['media.read'] }],
          }),
        ],
      })
    );
  });

  it('rolls back the persisted module assignment when IAM sync fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      revokeModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => ['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const deps = createDeps(repository);
    const service = createInstanceRegistryService(deps);

    await expect(
      service.assignModule({
        instanceId: 'demo',
        moduleId: 'events',
        idempotencyKey: 'idem-module-rollback-1',
        actorId: 'actor-1',
        requestId: 'req-module-rollback-1',
      })
    ).rejects.toThrow('sync_failed');

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.restoreModuleActivation).toHaveBeenCalledWith(
      'demo',
      'events',
      expect.objectContaining({ effectiveActive: true, manualOverride: 'enabled' })
    );
    expect(repository.appendAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_module_assigned',
      })
    );
    expect(deps.invalidatePermissionSnapshots).not.toHaveBeenCalled();
  });

  it('preserves sync and rollback failures when the rollback itself fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      restoreModuleActivation: vi.fn(async () => {
        throw new Error('rollback_failed');
      }),
      listAssignedModules: vi.fn(async () => ['news', 'events']),
      syncAssignedModuleIam: vi.fn(async () => {
        throw new Error('sync_failed');
      }),
      getInstanceById: vi.fn(async () => baseInstance),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    try {
      await service.assignModule({
        instanceId: 'demo',
        moduleId: 'events',
        idempotencyKey: 'idem-module-rollback-2',
        actorId: 'actor-1',
        requestId: 'req-module-rollback-2',
      });
      expect.unreachable('assignModule should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'instance_module_assign_rollback_failed:demo:events:sync_failed'
      );
      expect((error as Error).name).toBe('InstanceModuleAssignRollbackError');
      expect((error as Error).cause).toEqual({
        syncError: expect.any(Error),
        rollbackError: expect.any(Error),
      });
      expect(((error as Error).cause as { syncError: Error }).syncError.message).toBe(
        'sync_failed'
      );
      expect(((error as Error).cause as { rollbackError: Error }).rollbackError.message).toBe(
        'rollback_failed'
      );
    }
  });

  it('treats a create race during persistence as already_exists', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
      createInstance: vi.fn(async () => null as never),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.createProvisioningRequest({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'Studio.Example.Org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'studio-client',
        idempotencyKey: 'idem-race-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'already_exists' });
  });

  it('revokes a module and reseeds the remaining module IAM baseline', async () => {
    const repository = createRepository({
      revokeModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => []),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['categories', 'news'] })
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: [] }),
    });
    const service = createInstanceRegistryService(createDeps(repository));

    await expect(
      service.revokeModule({
        instanceId: 'demo',
        moduleId: 'news',
        confirmation: 'REVOKE',
        idempotencyKey: 'idem-module-2',
        actorId: 'actor-1',
        requestId: 'req-module-2',
      })
    ).resolves.toEqual({
      ok: true,
      instance: expect.objectContaining({
        assignedModules: [],
      }),
    });

    expect(repository.revokeModule).toHaveBeenNthCalledWith(1, 'demo', 'news');
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_module_revoked',
        details: expect.objectContaining({
          moduleId: 'news',
          outcome: 'revoked',
        }),
      })
    );
  });

  it('rejects revocation of a persisted required plugin before changing IAM state', async () => {
    const repository = createRepository({
      getModuleActivationPolicy: vi.fn(async () => ({
        activationPolicy: 'required',
        effectiveActive: true,
        stateRevision: 3,
      })),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).revokeModule({
        instanceId: 'demo',
        moduleId: 'news',
        confirmation: 'REVOKE',
        idempotencyKey: 'idem-required-revoke',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'plugin_activation_required_cannot_disable',
    });

    expect(repository.revokeModule).not.toHaveBeenCalled();
    expect(repository.syncAssignedModuleIam).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
  });

  it('disables waste provisioning on module revocation without deleting its state', async () => {
    const repository = createRepository({
      revokeModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => []),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['waste-management'] })
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: [] }),
    });

    await expect(
      createInstanceRegistryService(createDeps(repository)).revokeModule({
        instanceId: 'demo',
        moduleId: 'waste-management',
        confirmation: 'REVOKE',
        idempotencyKey: 'idem-revoke-waste',
        actorId: 'actor-1',
        requestId: 'req-revoke-waste',
      })
    ).resolves.toMatchObject({ ok: true });

    expect(repository.disableWasteProvisioning).toHaveBeenCalledWith('demo');
  });

  it('returns a local fallback keycloak status when no status snapshot exists yet', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        authClientSecretConfigured: false,
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretConfigured: false,
        },
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
      getAuthClientSecretCiphertext: vi.fn(async () => null),
      getTenantAdminClientSecretCiphertext: vi.fn(async () => null),
    });

    const status = await createGetKeycloakStatusHandler(createDeps(repository))('demo');

    expect(status).toEqual({
      realmExists: false,
      clientExists: false,
      tenantAdminClientExists: false,
      systemAdminRoleExists: false,
      tenantAdminExists: false,
      tenantAdminHasSystemAdmin: false,
      redirectUrisMatch: false,
      logoutUrisMatch: false,
      webOriginsMatch: false,
      clientSecretConfigured: false,
      tenantClientSecretReadable: false,
      clientSecretAligned: false,
      pluginOidcClientsAligned: false,
      tenantAdminClientSecretConfigured: false,
      tenantAdminClientSecretReadable: false,
      tenantAdminClientSecretAligned: false,
      runtimeSecretSource: 'global',
    });
  });

  it('invalidates a preflight snapshot after the instance contract changes', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        realmMode: 'existing' as const,
        tenantAdminBootstrap: undefined,
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          ...latestRun,
          steps: [
            {
              stepKey: 'worker_preflight_snapshot',
              title: 'Preflight',
              status: 'failed',
              summary: 'Blocked',
              details: {
                policyVersion: 3,
                inputFingerprint: buildKeycloakSnapshotInputFingerprint({
                  ...baseInstance,
                  updatedAt: '2026-01-01T00:00:00.000Z',
                }),
                preflight: {
                  overallStatus: 'blocked',
                  checkedAt: '2026-09-10T00:00:00.000Z',
                  checks: [
                    {
                      checkKey: 'tenant_admin_profile',
                      title: 'Tenant-Admin-Profil',
                      status: 'blocked',
                      summary: 'Für den Tenant-Admin fehlen die erforderlichen Stammdaten.',
                      details: { configured: false },
                    },
                  ],
                },
              },
            },
          ],
        },
      ]),
    });

    const preflight = await createGetKeycloakPreflightHandler(createDeps(repository))('demo');

    expect(preflight?.overallStatus).toBe('warning');
    expect(preflight?.checks).toContainEqual(
      expect.objectContaining({ checkKey: 'tenant_admin_profile', status: 'warning' })
    );
  });

  it('reuses finalized preflight and plan snapshots after provisioning changes registry inputs', async () => {
    const preflight = {
      overallStatus: 'ready' as const,
      checkedAt: '2026-09-11T12:00:00.000Z',
      checks: [],
    };
    const plan = {
      mode: 'existing' as const,
      overallStatus: 'ready' as const,
      generatedAt: '2026-09-11T12:00:00.000Z',
      driftSummary: 'Kein Drift.',
      steps: [],
    };
    const repository = createRepository({
      getInstanceById: vi.fn(async () => baseInstance),
      getAuthClientSecretCiphertext: vi.fn(async () => 'cipher-auth-v2'),
      getTenantAdminClientSecretCiphertext: vi.fn(async () => 'cipher-admin-v2'),
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          ...latestRun,
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'Status',
              status: 'done',
              summary: 'Final',
              details: {
                policyVersion: 3,
                inputFingerprint: buildKeycloakSnapshotInputFingerprint(baseInstance, {
                  authClientSecretCiphertext: 'cipher-auth-v2',
                  tenantAdminClientSecretCiphertext: 'cipher-admin-v2',
                }),
                preflight,
                plan,
              },
            },
          ],
        },
      ]),
    });
    const deps = createDeps(repository);

    await expect(createGetKeycloakPreflightHandler(deps)('demo')).resolves.toEqual(preflight);
    await expect(createPlanKeycloakProvisioningHandler(deps)('demo')).resolves.toEqual(plan);
  });

  it('invalidates an outdated imported-realm plan that would create a tenant admin', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        realmMode: 'existing' as const,
        tenantAdminBootstrap: undefined,
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          ...latestRun,
          steps: [
            {
              stepKey: 'worker_plan_snapshot',
              title: 'Plan',
              status: 'failed',
              summary: 'Blocked',
              details: {
                plan: {
                  mode: 'existing',
                  overallStatus: 'blocked',
                  generatedAt: '2026-09-10T00:00:00.000Z',
                  driftSummary: 'Provisioning ist blockiert.',
                  steps: [
                    {
                      stepKey: 'tenant_admin',
                      title: 'Tenant-Admin sicherstellen',
                      action: 'create',
                      status: 'blocked',
                      summary: 'Tenant-Admin wird erstellt.',
                      details: {},
                    },
                  ],
                },
              },
            },
          ],
        },
      ]),
    });

    const plan = await createPlanKeycloakProvisioningHandler(createDeps(repository))('demo');

    expect(plan).toMatchObject({
      overallStatus: 'ready',
      steps: expect.arrayContaining([
        expect.objectContaining({ stepKey: 'roles', action: 'create', status: 'ready' }),
        expect.objectContaining({ stepKey: 'tenant_admin', action: 'skip', status: 'ready' }),
      ]),
    });
  });

  it('returns a local fallback keycloak status without decrypting secrets when revealSecret is unavailable', async () => {
    const getAuthClientSecretCiphertext = vi.fn(async () => 'cipher-auth');
    const getTenantAdminClientSecretCiphertext = vi.fn(async () => 'cipher-admin');
    const repository = createRepository({
      getInstanceById: vi.fn(async () => ({
        ...baseInstance,
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretConfigured: true,
        },
      })),
      listKeycloakProvisioningRuns: vi.fn(async () => []),
      getAuthClientSecretCiphertext,
      getTenantAdminClientSecretCiphertext,
    });

    const status = await createGetKeycloakStatusHandler(
      createDeps(repository, { revealSecret: undefined })
    )('demo');

    expect(status).toEqual({
      realmExists: false,
      clientExists: false,
      tenantAdminClientExists: false,
      systemAdminRoleExists: false,
      tenantAdminExists: false,
      tenantAdminHasSystemAdmin: false,
      redirectUrisMatch: false,
      logoutUrisMatch: false,
      webOriginsMatch: false,
      clientSecretConfigured: true,
      tenantClientSecretReadable: false,
      clientSecretAligned: false,
      pluginOidcClientsAligned: false,
      tenantAdminClientSecretConfigured: true,
      tenantAdminClientSecretReadable: false,
      tenantAdminClientSecretAligned: false,
      runtimeSecretSource: 'global',
    });
    expect(getAuthClientSecretCiphertext).not.toHaveBeenCalled();
    expect(getTenantAdminClientSecretCiphertext).not.toHaveBeenCalled();
  });

  it('does not return a persisted keycloak status snapshot for unknown instances', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          id: 'keycloak-run-1',
          instanceId: 'demo',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'Done',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'Status',
              status: 'done',
              summary: 'Snapshot vorhanden',
              details: {
                policyVersion: 3,
                inputFingerprint: buildKeycloakSnapshotInputFingerprint(baseInstance),
                status: {
                  realmExists: true,
                  clientExists: true,
                  tenantAdminClientExists: true,
                  tenantAdminExists: true,
                  tenantAdminHasSystemAdmin: true,
                  redirectUrisMatch: true,
                  logoutUrisMatch: true,
                  webOriginsMatch: true,
                  clientSecretConfigured: true,
                  tenantClientSecretReadable: true,
                  clientSecretAligned: true,
                  tenantAdminClientSecretConfigured: true,
                  tenantAdminClientSecretReadable: true,
                  tenantAdminClientSecretAligned: true,
                  runtimeSecretSource: 'tenant',
                },
              },
            },
          ],
        },
      ]),
    });

    await expect(
      createGetKeycloakStatusHandler(createDeps(repository))('demo')
    ).resolves.toBeNull();
  });

  it('returns a persisted keycloak status snapshot without decrypting secrets', async () => {
    const getAuthClientSecretCiphertext = vi.fn(async () => 'auth-ciphertext');
    const getTenantAdminClientSecretCiphertext = vi.fn(async () => 'tenant-admin-ciphertext');
    const secretVersions = {
      authClientSecretCiphertext: 'auth-ciphertext',
      tenantAdminClientSecretCiphertext: 'tenant-admin-ciphertext',
    };
    const repository = createRepository({
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          id: 'keycloak-run-1',
          instanceId: 'demo',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'Done',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'Status',
              status: 'done',
              summary: 'Snapshot vorhanden',
              details: {
                policyVersion: 3,
                inputFingerprint: buildKeycloakSnapshotInputFingerprint(
                  baseInstance,
                  secretVersions
                ),
                status: {
                  realmExists: true,
                  clientExists: true,
                  tenantAdminClientExists: true,
                  tenantAdminExists: true,
                  tenantAdminHasSystemAdmin: true,
                  redirectUrisMatch: true,
                  logoutUrisMatch: true,
                  webOriginsMatch: true,
                  clientSecretConfigured: true,
                  tenantClientSecretReadable: true,
                  clientSecretAligned: true,
                  tenantAdminClientSecretConfigured: true,
                  tenantAdminClientSecretReadable: true,
                  tenantAdminClientSecretAligned: true,
                  runtimeSecretSource: 'tenant',
                },
              },
            },
          ],
        },
      ]),
      getAuthClientSecretCiphertext,
      getTenantAdminClientSecretCiphertext,
    });

    const status = await createGetKeycloakStatusHandler(
      createDeps(repository, { revealSecret: undefined })
    )('demo');

    expect(status).toEqual({
      realmExists: true,
      clientExists: true,
      tenantAdminClientExists: true,
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
      redirectUrisMatch: true,
      logoutUrisMatch: true,
      webOriginsMatch: true,
      clientSecretConfigured: true,
      tenantClientSecretReadable: true,
      clientSecretAligned: true,
      tenantAdminClientSecretConfigured: true,
      tenantAdminClientSecretReadable: true,
      tenantAdminClientSecretAligned: true,
      runtimeSecretSource: 'tenant',
    });
    expect(getAuthClientSecretCiphertext).toHaveBeenCalledWith('demo');
    expect(getTenantAdminClientSecretCiphertext).toHaveBeenCalledWith('demo');
  });

  it('ignores status snapshots from before ownership-aware role evaluation', async () => {
    const repository = createRepository({
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          ...latestRun,
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'Status',
              status: 'done',
              summary: 'Legacy snapshot',
              details: {
                status: {
                  realmExists: true,
                  systemAdminRoleExists: true,
                  runtimeSecretSource: 'tenant',
                },
              },
            },
          ],
        },
      ]),
    });

    const status = await createGetKeycloakStatusHandler(
      createDeps(repository, { revealSecret: undefined })
    )('demo');

    expect(status).toMatchObject({
      realmExists: false,
      systemAdminRoleExists: false,
      runtimeSecretSource: 'global',
    });
  });

  it('returns null for keycloak status snapshots when the instance no longer exists', async () => {
    const repository = createRepository({
      getInstanceById: vi.fn(async () => null),
      listKeycloakProvisioningRuns: vi.fn(async () => [
        {
          id: 'keycloak-run-1',
          instanceId: 'demo',
          mode: 'existing',
          intent: 'provision',
          overallStatus: 'succeeded',
          driftSummary: 'Done',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          steps: [
            {
              stepKey: 'status_snapshot',
              title: 'Status',
              status: 'done',
              summary: 'Snapshot vorhanden',
              details: {
                status: {
                  realmExists: true,
                },
              },
            },
          ],
        },
      ]),
    });

    const status = await createGetKeycloakStatusHandler(createDeps(repository))('demo');

    expect(status).toBeNull();
  });
});
