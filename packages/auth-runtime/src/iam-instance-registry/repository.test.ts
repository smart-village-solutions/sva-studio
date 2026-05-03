import { describe, expect, it, vi } from 'vitest';

import { studioModuleIamRegistry } from '@sva/studio-module-iam';

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
  it('injects the shared studio module iam registry into runtime and provisioning services', async () => {
    await import('./repository.js');

    expect(createInstanceRegistryRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceDeps: expect.objectContaining({
          moduleIamRegistry: studioModuleIamRegistry,
        }),
        provisioningWorkerServiceDeps: expect.objectContaining({
          moduleIamRegistry: studioModuleIamRegistry,
        }),
      })
    );
  });
});
