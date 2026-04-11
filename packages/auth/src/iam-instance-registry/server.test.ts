import { beforeEach, describe, expect, it, vi } from 'vitest';

const withRequestContextMock = vi.fn(async (_ctx: unknown, work: () => Promise<Response>) => work());
const toJsonErrorResponseMock = vi.fn(
  (status: number, code: string, message: string, options?: { requestId?: string }) =>
    new Response(JSON.stringify({ error: code, message, requestId: options?.requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
);
const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const withAuthenticatedUserMock = vi.fn();
const buildLogContextMock = vi.fn(() => ({ request_id: 'req-server', trace_id: 'trace-server' }));
const coreHandlers = {
  listInstancesInternal: vi.fn(),
  getInstanceInternal: vi.fn(),
  createInstanceInternal: vi.fn(),
  updateInstanceInternal: vi.fn(),
  activateInstanceInternal: vi.fn(),
  suspendInstanceInternal: vi.fn(),
  archiveInstanceInternal: vi.fn(),
};
const keycloakHandlers = {
  getInstanceKeycloakStatusInternal: vi.fn(),
  getInstanceKeycloakPreflightInternal: vi.fn(),
  planInstanceKeycloakProvisioningInternal: vi.fn(),
  executeInstanceKeycloakProvisioningInternal: vi.fn(),
  getInstanceKeycloakProvisioningRunInternal: vi.fn(),
  reconcileInstanceKeycloakInternal: vi.fn(),
};

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => loggerMock,
  toJsonErrorResponse: toJsonErrorResponseMock,
  withRequestContext: withRequestContextMock,
}));

vi.mock('../middleware.server.js', () => ({
  withAuthenticatedUser: withAuthenticatedUserMock,
}));

vi.mock('../shared/log-context.js', () => ({
  buildLogContext: buildLogContextMock,
}));

vi.mock('./core.js', () => coreHandlers);
vi.mock('./core-keycloak.js', () => keycloakHandlers);

describe('iam-instance-registry server handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    withAuthenticatedUserMock.mockImplementation(async (request, handler) =>
      handler({ request, user: { id: 'admin-1' }, sessionId: 'session-1' })
    );
    coreHandlers.listInstancesInternal.mockResolvedValue(new Response('list', { status: 200 }));
    coreHandlers.getInstanceInternal.mockResolvedValue(new Response('detail', { status: 200 }));
    coreHandlers.createInstanceInternal.mockResolvedValue(new Response('create', { status: 201 }));
    coreHandlers.updateInstanceInternal.mockResolvedValue(new Response('update', { status: 200 }));
    keycloakHandlers.getInstanceKeycloakStatusInternal.mockResolvedValue(new Response('status', { status: 200 }));
    keycloakHandlers.getInstanceKeycloakPreflightInternal.mockResolvedValue(new Response('preflight', { status: 200 }));
    keycloakHandlers.planInstanceKeycloakProvisioningInternal.mockResolvedValue(new Response('plan', { status: 200 }));
    keycloakHandlers.executeInstanceKeycloakProvisioningInternal.mockResolvedValue(new Response('execute', { status: 200 }));
    keycloakHandlers.getInstanceKeycloakProvisioningRunInternal.mockResolvedValue(new Response('run', { status: 200 }));
    keycloakHandlers.reconcileInstanceKeycloakInternal.mockResolvedValue(new Response('reconcile', { status: 200 }));
    coreHandlers.activateInstanceInternal.mockResolvedValue(new Response('activate', { status: 200 }));
    coreHandlers.suspendInstanceInternal.mockResolvedValue(new Response('suspend', { status: 200 }));
    coreHandlers.archiveInstanceInternal.mockResolvedValue(new Response('archive', { status: 200 }));
  });

  it('wraps registry handlers with request context and authentication', async () => {
    const { instanceRegistryHandlers } = await import('./server.js');
    const request = new Request('https://studio.example.org/api/v1/iam/instances');

    expect((await instanceRegistryHandlers.listInstances(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.getInstance(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.createInstance(request)).status).toBe(201);
    expect((await instanceRegistryHandlers.updateInstance(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.getInstanceKeycloakStatus(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.getInstanceKeycloakPreflight(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.planInstanceKeycloakProvisioning(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.executeInstanceKeycloakProvisioning(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.getInstanceKeycloakProvisioningRun(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.reconcileInstanceKeycloak(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.activateInstance(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.suspendInstance(request)).status).toBe(200);
    expect((await instanceRegistryHandlers.archiveInstance(request)).status).toBe(200);

    expect(withRequestContextMock).toHaveBeenCalled();
    expect(withAuthenticatedUserMock).toHaveBeenCalledTimes(13);
    expect(coreHandlers.listInstancesInternal).toHaveBeenCalled();
    expect(coreHandlers.archiveInstanceInternal).toHaveBeenCalled();
  });

  it('converts unexpected failures into sanitized json errors', async () => {
    withAuthenticatedUserMock.mockRejectedValueOnce(new Error('db offline'));
    const { instanceRegistryHandlers } = await import('./server.js');

    const response = await instanceRegistryHandlers.listInstances(new Request('https://studio.example.org/api/v1/iam/instances'));

    expect(response.status).toBe(500);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Instance registry request failed unexpectedly',
      expect.objectContaining({
        operation: 'instance_registry_request',
        error_type: 'Error',
        reason_code: 'platform_scope_unhandled_failure',
      })
    );
    expect(toJsonErrorResponseMock).toHaveBeenCalledWith(
      500,
      'internal_error',
      'Unbehandelter Instanzverwaltungsfehler.',
      { requestId: 'req-server' }
    );
  });
});
