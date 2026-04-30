import { describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import { createInstanceRegistryService } from './service.js';
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
  moduleIamRegistry: new Map([
    [
      'news',
      {
        moduleId: 'news',
        ownerPluginId: 'news',
        permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
        systemRoles: [
          { roleName: 'system_admin', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
          { roleName: 'editor', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
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
  ]),
  ...overrides,
});

describe('instance registry service facade', () => {
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
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: true,
        tenantAdminInstanceIdMatches: true,
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
          status: 'unknown',
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
      listAssignedModules: vi.fn(async () => ['news', 'events']),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce(baseInstance)
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['news', 'events'] }),
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
        assignedModules: ['news', 'events'],
      }),
    });

    expect(repository.assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(repository.syncAssignedModuleIam).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'demo',
        managedModuleIds: ['news', 'events'],
        contracts: expect.arrayContaining([
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

  it('invalidates instance permission snapshots after module IAM changes', async () => {
    const repository = createRepository({
      assignModule: vi.fn(async () => true),
      revokeModule: vi.fn(async () => true),
      getInstanceById: vi.fn(async () => baseInstance),
      listAssignedModules: vi
        .fn()
        .mockResolvedValueOnce(['news', 'events'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['news']),
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
              systemRoles: [{ roleName: 'editor', permissionIds: ['media.read', 'media.create'] }],
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

  it('revokes a module and reseeds the remaining module IAM baseline', async () => {
    const repository = createRepository({
      revokeModule: vi.fn(async () => true),
      listAssignedModules: vi.fn(async () => []),
      getInstanceById: vi
        .fn()
        .mockResolvedValueOnce({ ...baseInstance, assignedModules: ['news'] })
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

    expect(repository.revokeModule).toHaveBeenCalledWith('demo', 'news');
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
});
