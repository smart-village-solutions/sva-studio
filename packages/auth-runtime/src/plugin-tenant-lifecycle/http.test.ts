import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensurePlatformAccess: vi.fn(() => null),
  getInstanceById: vi.fn(),
  readConfiguredPluginTenantReadiness: vi.fn(),
  startConfiguredPluginTenantLifecycle: vi.fn(),
  isServiceRequest: true,
  validateSessionCsrf: vi.fn(() => null),
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
  isAuthenticatedRegistryServiceRequest: () => state.isServiceRequest,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: state.validateSessionCsrf,
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
    state.isServiceRequest = true;
    state.validateSessionCsrf.mockReturnValue(null);
    state.getInstanceById.mockResolvedValue({ instanceId: 'tenant-a' });
    state.readConfiguredPluginTenantReadiness.mockResolvedValue([
      { pluginId: 'speech', status: 'blocked' },
    ]);
    state.startConfiguredPluginTenantLifecycle.mockResolvedValue({
      lifecycle: { pluginId: 'speech', desiredGeneration: 4 },
      job: { id: 'job-4' },
    });
  });

  it.each([
    ['provision', 'instance.pluginLifecycle.provision'],
    ['readiness', 'instance.pluginLifecycle.readiness'],
    ['reconcile', 'instance.pluginLifecycle.reconcile'],
    ['suspend', 'instance.pluginLifecycle.suspend'],
    ['reactivate', 'instance.pluginLifecycle.reactivate'],
  ] as const)('maps %s to its dedicated service action', async (operation, expectedAction) => {
    const { resolvePluginTenantLifecycleServiceAction } = await import('./http.js');
    const result = await resolvePluginTenantLifecycleServiceAction(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation }),
      })
    );

    expect(result).toBe(expectedAction);
  });

  it('rejects an invalid operation before selecting a service action', async () => {
    const { resolvePluginTenantLifecycleServiceAction } = await import('./http.js');
    const result = await resolvePluginTenantLifecycleServiceAction(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation: 'unknown' }),
      })
    );

    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(400);
    }
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

  it('keeps session lifecycle mutations behind the central CSRF gate', async () => {
    state.isServiceRequest = false;
    const csrfResponse = new Response(null, { status: 403 });
    state.validateSessionCsrf.mockReturnValueOnce(csrfResponse);
    const { startPluginTenantLifecycleInternal } = await import('./http.js');
    const request = new Request(
      'https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation: 'reconcile' }),
      }
    );

    const response = await startPluginTenantLifecycleInternal(request, {
      authKind: 'session',
      user: { id: 'admin-1', roles: ['system_admin'] },
    } as never);

    expect(response).toBe(csrfResponse);
    expect(state.validateSessionCsrf).toHaveBeenCalledWith(request, 'request-a');
    expect(state.startConfiguredPluginTenantLifecycle).not.toHaveBeenCalled();
  });

  it('maps inactive plugin repairs to a stable conflict response', async () => {
    state.startConfiguredPluginTenantLifecycle.mockRejectedValue(
      new Error('plugin_tenant_lifecycle_inactive:speech:reconcile')
    );
    const { startPluginTenantLifecycleInternal } = await import('./http.js');
    const response = await startPluginTenantLifecycleInternal(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Accept-Language': 'en-US,en;q=0.9', 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'speech', operation: 'reconcile' }),
      }),
      context as never
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'plugin_tenant_lifecycle_inactive',
        message: 'The plugin lifecycle operation could not be started.',
      },
    });
  });

  it.each([
    'plugin_tenant_lifecycle_invalid_transition',
    'plugin_tenant_lifecycle_request_conflict',
  ] as const)('maps %s to a stable conflict response', async (errorCode) => {
    state.startConfiguredPluginTenantLifecycle.mockRejectedValue(
      new Error(`${errorCode}:speech:reconcile`)
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
    await expect(response.json()).resolves.toMatchObject({ error: { code: errorCode } });
  });

  it('localizes invalid lifecycle requests for English administrators', async () => {
    const { startPluginTenantLifecycleInternal } = await import('./http.js');
    const response = await startPluginTenantLifecycleInternal(
      new Request('https://studio.test/api/v1/iam/instances/tenant-a/plugin-readiness', {
        method: 'POST',
        headers: { 'Accept-Language': 'en', 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: 'INVALID', operation: 'reconcile' }),
      }),
      context as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'The request body is invalid.' },
    });
  });

  it.each([
    'plugin_tenant_lifecycle_job_creation_failed',
    'plugin_tenant_lifecycle_claim_failed',
  ] as const)('maps %s to a stable retryable service response', async (errorCode) => {
    state.startConfiguredPluginTenantLifecycle.mockRejectedValue(
      new Error(`${errorCode}:speech:reconcile`)
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

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: errorCode },
    });
  });

  it('does not expose readiness for an unknown instance', async () => {
    state.getInstanceById.mockResolvedValue(null);
    const { getPluginTenantReadinessInternal } = await import('./http.js');
    const response = await getPluginTenantReadinessInternal(
      new Request('https://studio.test/api/v1/iam/instances/missing/plugin-readiness', {
        headers: { 'Accept-Language': 'en-GB' },
      }),
      context as never
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', message: 'The instance was not found.' },
    });
    expect(state.readConfiguredPluginTenantReadiness).not.toHaveBeenCalled();
  });
});
