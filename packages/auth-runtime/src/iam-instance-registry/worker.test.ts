import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processKeycloak: vi.fn(),
  processTenant: vi.fn(),
  withDeps: vi.fn(),
  readReadiness: vi.fn(async () => []),
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
  readConfiguredPluginTenantReadiness: mocks.readReadiness,
}));

vi.mock('../kassel-tenant-provisioning.js', () => ({
  probeKasselTenantEndpoint: vi.fn(),
  publishConfiguredKasselTenantIngress: vi.fn(),
}));

describe('instance provisioning worker routing', () => {
  let runWorkerIteration: typeof import('./worker.js').runKeycloakProvisioningWorkerIteration;
  let readModuleReadiness: typeof import('./worker.js').readProvisioningModuleReadiness;

  beforeAll(async () => {
    ({
      runKeycloakProvisioningWorkerIteration: runWorkerIteration,
      readProvisioningModuleReadiness: readModuleReadiness,
    } = await import('./worker.js'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withDeps.mockImplementation(async (work) => work({ repository: {} }));
    mocks.readReadiness.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('processes the Kassel parent queue fairly while preserving the Keycloak result', async () => {
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');
    const childRun = { id: 'keycloak-run-1' };
    mocks.processKeycloak.mockResolvedValue(childRun);
    mocks.processTenant.mockResolvedValue({ id: 'parent-run-1' });

    await expect(runWorkerIteration()).resolves.toBe(childRun);
    expect(mocks.processTenant).toHaveBeenCalledOnce();
  });

  it('returns the Kassel parent result when the Keycloak queue is empty', async () => {
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

  it('keeps retryable blocked module readiness pending', async () => {
    mocks.readReadiness.mockResolvedValue([
      {
        pluginId: 'ssf',
        status: 'blocked',
        evidenceState: 'missing',
        revision: 1,
        error: { code: 'lifecycle_job_missing', retryKind: 'retryable' },
      },
    ]);

    await expect(readModuleReadiness('tenant-a')).resolves.toMatchObject({
      status: 'pending',
      evidence: { modules: [{ pluginId: 'ssf', errorCode: 'lifecycle_job_missing' }] },
    });
  });
});
