import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensurePlatformAccess: vi.fn(() => null),
  getInstanceById: vi.fn(),
  readConfiguredPluginTenantReadiness: vi.fn(),
  startConfiguredPluginTenantLifecycle: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  getWorkspaceContext: () => ({ requestId: 'request-a' }),
}));

vi.mock('../iam-instance-registry/http.js', () => ({
  ensurePlatformAccess: state.ensurePlatformAccess,
}));

vi.mock('../iam-instance-registry/repository.js', () => ({
  withRegistryRepository: async (work: (repository: unknown) => Promise<unknown>) =>
    work({ getInstanceById: state.getInstanceById }),
}));

vi.mock('../iam-instance-registry/service-token.js', () => ({
  isAuthenticatedRegistryServiceRequest: () => true,
}));

vi.mock('./read-model.js', () => ({
  readConfiguredPluginTenantReadiness: state.readConfiguredPluginTenantReadiness,
}));

vi.mock('./runtime.js', () => ({
  startConfiguredPluginTenantLifecycle: state.startConfiguredPluginTenantLifecycle,
}));

const context = {
  authKind: 'service' as const,
  user: { id: 'system-admin', roles: ['system_admin'] },
};

describe('plugin tenant lifecycle HTTP handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getInstanceById.mockResolvedValue({ instanceId: 'tenant-a' });
    state.readConfiguredPluginTenantReadiness.mockResolvedValue([
      { pluginId: 'speech', status: 'blocked' },
    ]);
    state.startConfiguredPluginTenantLifecycle.mockResolvedValue({
      lifecycle: { pluginId: 'speech', desiredGeneration: 4 },
      job: { id: 'job-4' },
    });
  });

  it('returns the generic readiness model for an existing instance', async () => {
    const { getPluginTenantReadinessInternal } = await import('./http.js');
    const response = await getPluginTenantReadinessInternal(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness'),
      context as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ pluginId: 'speech', status: 'blocked' }],
      requestId: 'request-a',
    });
    expect(state.readConfiguredPluginTenantReadiness).toHaveBeenCalledWith('tenant-a');
  });

  it('starts a declared repair operation in the authenticated actor context', async () => {
    const { startPluginTenantLifecycleInternal } = await import('./http.js');
    const response = await startPluginTenantLifecycleInternal(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation: 'reconcile' }),
      }),
      context as never
    );

    expect(response.status).toBe(202);
    expect(state.startConfiguredPluginTenantLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        operation: 'reconcile',
        actorAccountId: 'system-admin',
        requestId: 'request-a',
      })
    );
  });

  it('maps inactive plugin repairs to a stable conflict response', async () => {
    state.startConfiguredPluginTenantLifecycle.mockRejectedValue(
      new Error('plugin_tenant_lifecycle_inactive:speech:reconcile')
    );
    const { startPluginTenantLifecycleInternal } = await import('./http.js');
    const response = await startPluginTenantLifecycleInternal(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation: 'reconcile' }),
      }),
      context as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'plugin_tenant_lifecycle_inactive' },
    });
  });

  it('does not expose readiness for an unknown instance', async () => {
    state.getInstanceById.mockResolvedValue(null);
    const { getPluginTenantReadinessInternal } = await import('./http.js');
    const response = await getPluginTenantReadinessInternal(
      new Request('https://studio.test/api/v1/iam/instances/missing/plugin-readiness'),
      context as never
    );

    expect(response.status).toBe(404);
    expect(state.readConfiguredPluginTenantReadiness).not.toHaveBeenCalled();
  });
});
