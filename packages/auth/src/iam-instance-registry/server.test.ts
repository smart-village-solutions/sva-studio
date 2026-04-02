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
  activateInstanceInternal: vi.fn(),
  suspendInstanceInternal: vi.fn(),
  archiveInstanceInternal: vi.fn(),
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
    coreHandlers.activateInstanceInternal.mockResolvedValue(new Response('activate', { status: 200 }));
    coreHandlers.suspendInstanceInternal.mockResolvedValue(new Response('suspend', { status: 200 }));
    coreHandlers.archiveInstanceInternal.mockResolvedValue(new Response('archive', { status: 200 }));
  });

  it('wraps registry handlers with request context and authentication', async () => {
    const {
      listInstancesHandler,
      getInstanceHandler,
      createInstanceHandler,
      activateInstanceHandler,
      suspendInstanceHandler,
      archiveInstanceHandler,
    } = await import('./server.js');
    const request = new Request('https://studio.example.org/api/v1/iam/instances');

    expect((await listInstancesHandler(request)).status).toBe(200);
    expect((await getInstanceHandler(request)).status).toBe(200);
    expect((await createInstanceHandler(request)).status).toBe(201);
    expect((await activateInstanceHandler(request)).status).toBe(200);
    expect((await suspendInstanceHandler(request)).status).toBe(200);
    expect((await archiveInstanceHandler(request)).status).toBe(200);

    expect(withRequestContextMock).toHaveBeenCalled();
    expect(withAuthenticatedUserMock).toHaveBeenCalledTimes(6);
    expect(coreHandlers.listInstancesInternal).toHaveBeenCalled();
    expect(coreHandlers.archiveInstanceInternal).toHaveBeenCalled();
  });

  it('converts unexpected failures into sanitized json errors', async () => {
    withAuthenticatedUserMock.mockRejectedValueOnce(new Error('db offline'));
    const { listInstancesHandler } = await import('./server.js');

    const response = await listInstancesHandler(new Request('https://studio.example.org/api/v1/iam/instances'));

    expect(response.status).toBe(500);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Instance registry request failed unexpectedly',
      expect.objectContaining({
        operation: 'instance_registry_request',
        error_type: 'Error',
        error_message: 'db offline',
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
