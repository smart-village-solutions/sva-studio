import { describe, expect, it, vi } from 'vitest';

const createInstanceRegistryRuntimeMock = vi.fn(() => ({
  withRegistryRepository: vi.fn(),
  withRegistryService: vi.fn(),
  withRegistryProvisioningWorkerService: vi.fn(),
  withRegistryProvisioningWorkerDeps: vi.fn(),
}));

vi.mock('../db.js', () => ({
  createPoolResolver: vi.fn(() => 'resolve-pool'),
}));

vi.mock('@sva/data-repositories', () => ({
  createInstanceRegistryRepository: vi.fn(() => 'repository'),
}));

vi.mock('@sva/data-repositories/server', () => ({
  invalidateInstanceRegistryHost: vi.fn(),
}));

vi.mock('@sva/instance-registry/runtime-wiring', () => ({
  createInstanceRegistryRuntime: createInstanceRegistryRuntimeMock,
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
        }),
        provisioningWorkerServiceDeps: expect.objectContaining({
          moduleIamRegistry: serviceRegistry,
        }),
      })
    );
  });
});
