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
import { createGetKeycloakStatusHandler } from './service-keycloak.js';
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const createRepository = (overrides: Partial<InstanceRegistryRepository> = {}): InstanceRegistryRepository =>
  ({
    listInstances: vi.fn(async () => [baseInstance]),
    getInstanceById: vi.fn(async () => baseInstance),
    listAssignedModules: vi.fn(async () => baseInstance.assignedModules),
    assignModule: vi.fn(async () => true),
    revokeModule: vi.fn(async () => true),
    syncAssignedModuleIam: vi.fn(async () => undefined),
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
        permissionIds: ['categories.read', 'categories.create', 'categories.update', 'categories.delete'],
        systemRoles: [
          {
            roleName: 'system_admin',
            permissionIds: ['categories.read', 'categories.create', 'categories.update', 'categories.delete'],
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
          { roleName: 'system_admin', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
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
      instanceId: 'demo', actorId: 'service-account', actionId: 'instance.secret.rotate',
      outcome: 'rejected', reason: 'invalid_confirmation', requestId: 'req-confirm',
    });

    expect(repository.appendAuditEvent).toHaveBeenCalledWith({
      instanceId: 'demo', eventType: 'instance_confirmation_rejected', actorId: 'service-account', requestId: 'req-confirm',
      details: { actionId: 'instance.secret.rotate', outcome: 'rejected', reason: 'invalid_confirmation' },
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch
    );

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
          actual: 'keycloak unavailable',
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })) as typeof fetch
    );

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
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'already_exists' });
    expect(repository.createInstance).not.toHaveBeenCalled();
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
      instance: expect.objectContaining({ instanceId: 'demo', primaryHostname: 'demo.studio.example.org' }),
    });

    expect(repository.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        authClientSecretCiphertext:
          'protected:iam.instances.auth_client_secret:demo:auth-secret',
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretCiphertext:
            'protected:iam.instances.tenant_admin_client_secret:demo:tenant-secret',
        },
      })
    );
    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'create', status: 'requested' })
    );
    expect(deps.invalidateHost).toHaveBeenCalledWith('demo.studio.example.org');
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
      createInstanceRegistryService(createDeps(createRepository({ getInstanceById: vi.fn(async () => null) }))).changeStatus({
        instanceId: 'missing',
        nextStatus: 'active',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'not_found' });

    await expect(
      createInstanceRegistryService(
        createDeps(createRepository({ getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'active' as const })) }))
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
        createDeps(createRepository({ getInstanceById: vi.fn(async () => ({ ...baseInstance, status: 'archived' as const })) }))
      ).changeStatus({
        instanceId: 'demo',
        nextStatus: 'active',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({ ok: false, reason: 'invalid_transition', currentStatus: 'archived' });
  });

  it('updates instances and returns detail projections', async () => {
    const updated = {
      ...baseInstance,
      displayName: 'Updated',
      parentDomain: 'example.org',
      primaryHostname: 'demo.example.org',
    };
    const repository = createRepository({
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValue(updated),
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
        hostnames: [{ hostname: 'demo.example.org', isPrimary: true, createdAt: baseInstance.createdAt }],
      })
    );

    expect(repository.updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDomain: 'example.org',
        primaryHostname: 'demo.example.org',
        keepExistingAuthClientSecret: true,
        keepExistingTenantAdminClientSecret: true,
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
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValue(updated),
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
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['categories', 'events', 'news'] }),
    });
    const service = createInstanceRegistryService(createDeps(repository));

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

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: expect.arrayContaining(['categories', 'news', 'events', 'waste-management']),
        contracts: expect.arrayContaining([
          expect.objectContaining({ moduleId: 'categories' }),
          expect.objectContaining({ moduleId: 'news' }),
          expect.objectContaining({ moduleId: 'events' }),
        ]),
      })
    );
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
      listAssignedModules: vi.fn().mockResolvedValueOnce(['news']).mockResolvedValueOnce(['categories', 'events', 'news']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['categories', 'events', 'news'] }),
    });
    const service = createInstanceRegistryService(createDeps(repository));

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
    expect(repository.assignModule).toHaveBeenNthCalledWith(2, 'demo', 'events');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: expect.arrayContaining(['categories', 'news', 'events', 'waste-management']),
      })
    );
    expect(repository.syncProtectedSystemRolePermissions).toHaveBeenCalledWith({
      instanceId: 'demo',
      role: expect.objectContaining({
        roleKey: 'system_admin',
        roleLevel: 100,
        permissionKeys: expect.arrayContaining([
          'iam.user.read',
          'iam.user.write',
          'iam.role.read',
          'iam.role.write',
          'app.read',
          'cockpit.read',
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
      listAssignedModules: vi.fn().mockResolvedValueOnce(['news']).mockResolvedValueOnce(['news', 'events']),
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
        contracts: expect.arrayContaining([expect.objectContaining({ moduleId: 'news' }), expect.objectContaining({ moduleId: 'events' })]),
      })
    );
    expect(repository.syncProtectedSystemRolePermissions).toHaveBeenCalled();
  });

  it('rolls back newly assigned modules when bootstrap module IAM sync fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      revokeModule: vi.fn(async () => true),
      listAssignedModules: vi.fn().mockResolvedValueOnce(['news']).mockResolvedValueOnce(['news', 'events']),
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
    expect(repository.revokeModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.syncProtectedSystemRolePermissions).not.toHaveBeenCalled();
    expect(repository.appendAuditEvent).not.toHaveBeenCalled();
    expect(deps.invalidatePermissionSnapshots).not.toHaveBeenCalled();
  });

  it('throws a bootstrap rollback error when reverting newly assigned modules also fails', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      revokeModule: vi.fn(async () => {
        throw new Error('rollback_failed');
      }),
      listAssignedModules: vi.fn().mockResolvedValueOnce(['news']).mockResolvedValueOnce(['news', 'events']),
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
      expect(((error as Error).cause as { syncError: Error }).syncError.message).toBe('sync_failed');
      expect(((error as Error).cause as { rollbackError: Error }).rollbackError.message).toBe('rollback_failed');
    }
  });

  it('throws a bootstrap rollback error when revokeModule reports that rollback did not remove a module', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async (instanceId: string, moduleId: string) => moduleId === 'events'),
      revokeModule: vi.fn(async () => false),
      listAssignedModules: vi.fn().mockResolvedValueOnce(['news']).mockResolvedValueOnce(['news', 'events']),
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
        'rollback_revoke_failed:events'
      );
    }
  });

  it('invalidates instance permission snapshots after module IAM changes', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      revokeModule: vi.fn(async () => true),
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
        permissionKeys: expect.arrayContaining(['iam.user.read', 'content.read', 'app.read']),
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
              systemRoles: [{ roleName: 'system_admin', permissionIds: ['media.read', 'media.create'] }],
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
        contracts: [expect.objectContaining({ moduleId: 'media' })],
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
    expect(repository.revokeModule).toHaveBeenCalledWith('demo', 'events');
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
      revokeModule: vi.fn(async () => {
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
      expect((error as Error).message).toBe('instance_module_assign_rollback_failed:demo:events:sync_failed');
      expect((error as Error).name).toBe('InstanceModuleAssignRollbackError');
      expect((error as Error).cause).toEqual({
        syncError: expect.any(Error),
        rollbackError: expect.any(Error),
      });
      expect(((error as Error).cause as { syncError: Error }).syncError.message).toBe('sync_failed');
      expect(((error as Error).cause as { rollbackError: Error }).rollbackError.message).toBe('rollback_failed');
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
      tenantAdminClientSecretConfigured: false,
      tenantAdminClientSecretReadable: false,
      tenantAdminClientSecretAligned: false,
      runtimeSecretSource: 'global',
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

    const status = await createGetKeycloakStatusHandler(createDeps(repository, { revealSecret: undefined }))('demo');

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

    await expect(createGetKeycloakStatusHandler(createDeps(repository))('demo')).resolves.toBeNull();
  });

  it('returns a persisted keycloak status snapshot without loading secrets', async () => {
    const getAuthClientSecretCiphertext = vi.fn(async () => {
      throw new Error('should_not_load_auth_secret');
    });
    const getTenantAdminClientSecretCiphertext = vi.fn(async () => {
      throw new Error('should_not_load_tenant_secret');
    });
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

    const status = await createGetKeycloakStatusHandler(createDeps(repository, { revealSecret: undefined }))('demo');

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
    expect(getAuthClientSecretCiphertext).not.toHaveBeenCalled();
    expect(getTenantAdminClientSecretCiphertext).not.toHaveBeenCalled();
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
