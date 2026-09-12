import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processKeycloak: vi.fn(),
  processTenant: vi.fn(),
  withDeps: vi.fn(),
}));

vi.mock('@sva/instance-registry/provisioning-worker', () => ({
  isWorkerEntrypoint: () => false,
  processNextTenantProvisioningRun: mocks.processTenant,
  runKeycloakProvisioningWorkerLoop: vi.fn(),
}));

vi.mock('./repository.js', () => ({
  runConfiguredPluginTenantProvisioningSchedule: vi.fn(),
  withRegistryProvisioningWorkerDeps: mocks.withDeps,
}));

vi.mock('./service-keycloak-execution.js', () => ({
  processNextQueuedKeycloakProvisioningRun: mocks.processKeycloak,
}));

vi.mock('../plugin-tenant-lifecycle/read-model.js', () => ({
  readConfiguredPluginTenantReadiness: vi.fn(async () => []),
}));

vi.mock('../kassel-tenant-provisioning.js', () => ({
  probeKasselTenantEndpoint: vi.fn(),
  publishConfiguredKasselTenantIngress: vi.fn(),
}));

describe('instance provisioning worker routing', () => {
  let runWorkerIteration: typeof import('./worker.js').runKeycloakProvisioningWorkerIteration;

  beforeAll(async () => {
    ({ runKeycloakProvisioningWorkerIteration: runWorkerIteration } = await import('./worker.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withDeps.mockImplementation(async (work) => work({ repository: {} }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the existing Keycloak queue first', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const childRun = { id: 'keycloak-run-1' };
    mocks.processKeycloak.mockResolvedValue(childRun);

    await expect(runWorkerIteration()).resolves.toBe(childRun);
    expect(mocks.processTenant).not.toHaveBeenCalled();
  });

  it('claims the Kassel parent queue only after the Keycloak queue is empty', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    mocks.processKeycloak.mockResolvedValue(null);
    mocks.processTenant.mockResolvedValue({ id: 'parent-run-1' });

    await expect(runWorkerIteration()).resolves.toEqual({ id: 'parent-run-1' });
    expect(mocks.processTenant).toHaveBeenCalledWith(
      expect.objectContaining({ repository: {} }),
      expect.objectContaining({ workerId: expect.stringMatching(/^kassel-tenant-provisioner:/u) })
    );
  });

  it('does not run the Kassel parent queue in other environments', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'external');
    mocks.processKeycloak.mockResolvedValue(null);

    await expect(runWorkerIteration()).resolves.toBeNull();
    expect(mocks.processTenant).not.toHaveBeenCalled();
  });
});
