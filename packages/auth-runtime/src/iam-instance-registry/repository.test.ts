import { describe, expect, it, vi } from 'vitest';

const createInstanceRegistryRuntimeMock = vi.fn(() => ({
  withRegistryRepository: vi.fn(),
  withRegistryService: vi.fn(),
  withRegistryProvisioningWorkerService: vi.fn(),
  withRegistryProvisioningWorkerDeps: vi.fn(),
}));
const resolveIdentityProviderForInstanceMock = vi.fn();
const resolveAuthConfigForInstanceMock = vi.fn();
const studioModuleIamRegistryMock = new Map([
  [
    'news',
    {
      moduleId: 'news',
      permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
      systemRoles: [{ roleName: 'system_admin', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] }],
    },
  ],
  [
    'media',
    {
      moduleId: 'media',
      permissionIds: [
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
        'media.delete',
        'media.deliver.protected',
      ],
      systemRoles: [{ roleName: 'system_admin', permissionIds: ['media.read'] }],
    },
  ],
]);

vi.mock('../db.js', () => ({
  createPoolResolver: vi.fn(() => 'resolve-pool'),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
  }),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-test', traceId: 'trace-test' })),
  getInstanceConfig: vi.fn(() => null),
  isCanonicalAuthHost: vi.fn(() => true),
}));

vi.mock('@sva/data-repositories', () => ({
  createInstanceRegistryRepository: vi.fn(() => 'repository'),
}));

vi.mock('@sva/data-repositories/server', () => ({
  invalidateInstanceRegistryHost: vi.fn(),
  loadWasteDataSourceRecord: vi.fn(),
  saveWasteDataSourceRecord: vi.fn(),
}));

vi.mock('@sva/instance-registry/runtime-wiring', () => ({
  createInstanceRegistryRuntime: createInstanceRegistryRuntimeMock,
}));

vi.mock('@sva/studio-module-iam', () => ({
  studioModuleIamRegistry: studioModuleIamRegistryMock,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: vi.fn(() => 'postgres://iam'),
}));

vi.mock('./provisioning-auth.js', () => ({
  getInstanceKeycloakPlanViaProvisioner: vi.fn(),
  getInstanceKeycloakPreflightViaProvisioner: vi.fn(),
  getInstanceKeycloakStatusViaProvisioner: vi.fn(),
  provisionInstanceAuthArtifactsViaProvisioner: vi.fn(),
}));

vi.mock('./provisioning-auth-state.js', () => ({
  readKeycloakStateViaProvisioner: vi.fn(),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn(),
  revealField: vi.fn(),
}));

vi.mock('../iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: (...args: unknown[]) => resolveIdentityProviderForInstanceMock(...args),
  isKeycloakIdentityProvider: (provider: unknown) => typeof provider === 'object' && provider !== null && 'getOidcClientByClientId' in provider,
}));

vi.mock('../config.js', () => ({
  resolveAuthConfigForInstance: (...args: unknown[]) => resolveAuthConfigForInstanceMock(...args),
}));

describe('iam instance registry repository wiring', () => {
  it('injects a shared module iam registry into runtime and provisioning services', async () => {
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls[0]?.[0];
    expect(runtimeConfig).toBeDefined();

    const serviceRegistry = runtimeConfig?.serviceDeps.moduleIamRegistry;
    const workerRegistry = runtimeConfig?.provisioningWorkerServiceDeps.moduleIamRegistry;

    expect(serviceRegistry).toBe(workerRegistry);
    expect(serviceRegistry).toBeInstanceOf(Map);
    expect(serviceRegistry?.get('news')).toEqual(
      expect.objectContaining({
        moduleId: 'news',
        permissionIds: expect.arrayContaining(['news.read', 'news.create', 'news.update', 'news.delete']),
      })
    );
    expect(serviceRegistry?.get('media')).toEqual(
      expect.objectContaining({
        moduleId: 'media',
        permissionIds: expect.arrayContaining([
          'media.read',
          'media.create',
          'media.update',
          'media.reference.manage',
          'media.delete',
          'media.deliver.protected',
        ]),
      })
    );

    expect(createInstanceRegistryRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceDeps: expect.objectContaining({
          moduleIamRegistry: serviceRegistry,
          loadWasteDataSourceRecord: expect.any(Function),
          saveWasteDataSourceRecord: expect.any(Function),
        }),
        provisioningWorkerServiceDeps: expect.objectContaining({
          moduleIamRegistry: serviceRegistry,
          loadWasteDataSourceRecord: expect.any(Function),
          saveWasteDataSourceRecord: expect.any(Function),
        }),
      })
    );
  });

  it('reports blocked tenant IAM access instead of throwing when the tenant admin client is missing', async () => {
    resolveIdentityProviderForInstanceMock.mockResolvedValueOnce(null);
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls.at(-1)?.[0];
    expect(runtimeConfig).toBeDefined();

    await expect(
      runtimeConfig?.serviceDeps.probeTenantIamAccess({
        instanceId: 'demo',
        requestId: 'req-probe-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'blocked',
        summary: 'Tenant-Admin-Client ist für diese Instanz noch nicht konfiguriert.',
        source: 'access_probe',
        errorCode: 'tenant_admin_client_not_configured',
        requestId: 'req-probe-1',
      })
    );
  });

  it('reports ready tenant IAM access when password setup emails can be triggered for the configured login client', async () => {
    resolveIdentityProviderForInstanceMock.mockResolvedValueOnce({
      provider: {
        listRoles: vi.fn(async () => []),
        listUsers: vi.fn(async () => []),
        executeActionsEmail: vi.fn(async () => undefined),
        getOidcClientByClientId: vi.fn(async () => ({ id: 'client-1', clientId: 'sva-studio' })),
      },
    });
    resolveAuthConfigForInstanceMock.mockResolvedValueOnce({
      clientId: 'sva-studio',
    });
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls.at(-1)?.[0];
    expect(runtimeConfig).toBeDefined();

    await expect(
      runtimeConfig?.serviceDeps.probeTenantIamAccess({
        instanceId: 'demo',
        requestId: 'req-probe-2',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        summary:
          'Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails über den Login-Client sva-studio anstoßen.',
        source: 'access_probe',
        requestId: 'req-probe-2',
      })
    );
  });

  it('reports blocked tenant IAM access when the referenced login client is missing in the tenant realm', async () => {
    resolveIdentityProviderForInstanceMock.mockResolvedValueOnce({
      provider: {
        listRoles: vi.fn(async () => []),
        listUsers: vi.fn(async () => []),
        executeActionsEmail: vi.fn(async () => undefined),
        getOidcClientByClientId: vi.fn(async () => null),
      },
    });
    resolveAuthConfigForInstanceMock.mockResolvedValueOnce({
      clientId: 'sva-studio',
    });
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls.at(-1)?.[0];
    expect(runtimeConfig).toBeDefined();

    await expect(
      runtimeConfig?.serviceDeps.probeTenantIamAccess({
        instanceId: 'demo',
        requestId: 'req-probe-3',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'blocked',
        summary: 'Der referenzierte Login-Client sva-studio fehlt im Tenant-Realm.',
        source: 'access_probe',
        errorCode: 'AUTH_CLIENT_MISSING',
        requestId: 'req-probe-3',
      })
    );
  });

  it('reports forbidden tenant IAM access without implying that only role reads failed', async () => {
    resolveIdentityProviderForInstanceMock.mockResolvedValueOnce({
      provider: {
        listRoles: vi.fn(async () => []),
        listUsers: vi.fn(async () => {
          throw new Error('403 Forbidden');
        }),
        executeActionsEmail: vi.fn(async () => undefined),
        getOidcClientByClientId: vi.fn(async () => ({ id: 'client-1', clientId: 'sva-studio' })),
      },
    });
    resolveAuthConfigForInstanceMock.mockResolvedValueOnce({
      clientId: 'sva-studio',
    });
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls.at(-1)?.[0];
    expect(runtimeConfig).toBeDefined();

    await expect(
      runtimeConfig?.serviceDeps.probeTenantIamAccess({
        instanceId: 'demo',
        requestId: 'req-probe-4',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'blocked',
        summary: 'Tenant-Admin-Client darf die erforderlichen IAM-Ressourcen nicht lesen.',
        source: 'access_probe',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-probe-4',
      })
    );
  });

  it('does not leak a follow-up capability rejection when IAM reads already failed', async () => {
    const unhandledRejectionHandler = vi.fn();
    process.once('unhandledRejection', unhandledRejectionHandler);

    resolveIdentityProviderForInstanceMock.mockResolvedValueOnce({
      provider: {
        listRoles: vi.fn(async () => {
          throw new Error('403 Forbidden');
        }),
        listUsers: vi.fn(async () => []),
        executeActionsEmail: vi.fn(async () => undefined),
        getOidcClientByClientId: vi.fn(async () => ({ id: 'client-1', clientId: 'sva-studio' })),
      },
    });
    resolveAuthConfigForInstanceMock.mockRejectedValueOnce(new Error('config failed'));
    await import('./repository.js');

    const runtimeConfig = createInstanceRegistryRuntimeMock.mock.calls.at(-1)?.[0];
    expect(runtimeConfig).toBeDefined();

    await expect(
      runtimeConfig?.serviceDeps.probeTenantIamAccess({
        instanceId: 'demo',
        requestId: 'req-probe-5',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'blocked',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-probe-5',
      })
    );

    await Promise.resolve();
    expect(unhandledRejectionHandler).not.toHaveBeenCalled();
  });
});
