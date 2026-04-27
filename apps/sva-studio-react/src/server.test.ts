import { afterEach, describe, expect, it, vi } from 'vitest';

const createStartHandlerMock = vi.fn();
const createSdkLoggerMock = vi.fn();
const dispatchAuthRouteRequestMock = vi.fn();
const dispatchMainserverNewsRequestMock = vi.fn();
const dispatchMainserverEventsPoiRequestMock = vi.fn();
const getWorkspaceContextMock = vi.fn();
const withRequestContextMock = vi.fn();
const createServerFunctionRequestDiagnosticsMock = vi.fn();
const readServerFunctionResponseBodyForDiagnosticsMock = vi.fn();
const resolveServerFunctionBranchDecisionMock = vi.fn();

vi.mock('@tanstack/react-start/server', () => ({
  createStartHandler: createStartHandlerMock,
  defaultStreamHandler: {},
}));

vi.mock('@tanstack/react-start/server-entry', () => ({
  createServerEntry: vi.fn((entry) => entry),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: createSdkLoggerMock,
  getWorkspaceContext: getWorkspaceContextMock,
  withRequestContext: withRequestContextMock,
}));

vi.mock('@sva/routing/server', () => ({
  dispatchAuthRouteRequest: dispatchAuthRouteRequestMock,
}));

vi.mock('./lib/mainserver-news-api.server', () => ({
  dispatchMainserverNewsRequest: dispatchMainserverNewsRequestMock,
}));

vi.mock('./lib/mainserver-events-poi-api.server', () => ({
  dispatchMainserverEventsPoiRequest: dispatchMainserverEventsPoiRequestMock,
}));

vi.mock('./lib/server-function-request-diagnostics.server', () => ({
  createServerFunctionRequestDiagnostics: createServerFunctionRequestDiagnosticsMock,
  normalizeServerFnBase: vi.fn(() => '/_server'),
  readServerFunctionResponseBodyForDiagnostics: readServerFunctionResponseBodyForDiagnosticsMock,
  resolveServerFunctionBranchDecision: resolveServerFunctionBranchDecisionMock,
}));

describe('server transport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createStartHandlerMock.mockReset();
    createSdkLoggerMock.mockReset();
    dispatchAuthRouteRequestMock.mockReset();
    dispatchMainserverNewsRequestMock.mockReset();
    dispatchMainserverEventsPoiRequestMock.mockReset();
    getWorkspaceContextMock.mockReset();
    withRequestContextMock.mockReset();
    createServerFunctionRequestDiagnosticsMock.mockReset();
    readServerFunctionResponseBodyForDiagnosticsMock.mockReset();
    resolveServerFunctionBranchDecisionMock.mockReset();
  });

  it('bypasses auth requests before TanStack Start', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(new Response('auth', { status: 200 }));
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/auth/login'));

    expect(dispatchAuthRouteRequestMock).toHaveBeenCalledTimes(1);
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('auth');
  });

  it('bypasses mainserver news requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    dispatchMainserverNewsRequestMock.mockResolvedValue(new Response('news', { status: 200 }));
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/api/v1/mainserver/news'));

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('news');
  });

  it('bypasses mainserver events and poi requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(new Response('events', { status: 200 }));
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/api/v1/mainserver/events'));

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverEventsPoiRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('events');
  });

  it('bypasses diagnostics for non server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(new Response('plain', { status: 200 }));
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    withRequestContextMock.mockImplementation(async (_input, callback) => callback());
    getWorkspaceContextMock.mockReturnValue({ requestId: 'req-non-server' });
    createSdkLoggerMock.mockReturnValue({ info: vi.fn() });
    createServerFunctionRequestDiagnosticsMock.mockReturnValue({
      isServerFnRequest: false,
      requestId: 'req-non-server',
    });

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/admin/users'));

    expect(withRequestContextMock).toHaveBeenCalledTimes(1);
    expect(startFetch).toHaveBeenCalledTimes(1);
    expect(createSdkLoggerMock).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('plain');
  });

  it('logs routed server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const logger = { info: vi.fn() };
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    createSdkLoggerMock.mockReturnValue(logger);
    getWorkspaceContextMock.mockReturnValue({ requestId: 'req-server-fn' });
    withRequestContextMock.mockImplementation(async (_input, callback) => callback());
    createServerFunctionRequestDiagnosticsMock.mockReturnValue({
      isServerFnRequest: true,
      requestId: 'req-server-fn',
      method: 'POST',
      path: '/_server/demo',
      serverFnBase: '/_server',
      accept: 'application/json',
      contentType: 'application/json',
    });
    readServerFunctionResponseBodyForDiagnosticsMock.mockResolvedValue('{"ok":false}');
    resolveServerFunctionBranchDecisionMock.mockReturnValue('html_router_fallback');

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/_server/demo', { method: 'POST' }));

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Server function request received',
      expect.objectContaining({ request_id: 'req-server-fn', path: '/_server/demo' }),
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'Server function request routed',
      expect.objectContaining({ branch_decision: 'html_router_fallback', http_status: 500 }),
    );
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it('delegates directly in production without request diagnostics', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_SERVER_ENTRY_DEBUG', 'true');

    const startFetch = vi.fn().mockResolvedValue(new Response('prod', { status: 204 }));
    const logger = { info: vi.fn() };
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    createSdkLoggerMock.mockReturnValue(logger);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/admin/users'));

    expect(startFetch).toHaveBeenCalledTimes(1);
    expect(withRequestContextMock).not.toHaveBeenCalled();
    expect(createServerFunctionRequestDiagnosticsMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Server entry request received',
      expect.objectContaining({ path: '/admin/users' })
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'Server entry delegated to start handler',
      expect.objectContaining({ diagnostics_enabled: false })
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      3,
      'Server entry response completed',
      expect.objectContaining({ diagnostics_enabled: false, status: 204 })
    );
    await expect(response.text()).resolves.toBe('prod');
  });

  it('logs debug completion for non-server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_SERVER_ENTRY_DEBUG', 'true');

    const startFetch = vi.fn().mockResolvedValue(new Response('plain', { status: 202 }));
    const logger = { info: vi.fn() };
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsPoiRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    withRequestContextMock.mockImplementation(async (_input, callback) => callback());
    getWorkspaceContextMock.mockReturnValue({ requestId: null });
    createSdkLoggerMock.mockReturnValue(logger);
    createServerFunctionRequestDiagnosticsMock.mockReturnValue({
      isServerFnRequest: false,
      requestId: 'unknown',
    });

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/admin/groups'));

    expect(createServerFunctionRequestDiagnosticsMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'unknown' })
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Server entry request received',
      expect.objectContaining({ path: '/admin/groups' })
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'Server entry delegated to start handler',
      expect.objectContaining({ diagnostics_enabled: true, server_fn_request: false })
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      3,
      'Server entry response completed',
      expect.objectContaining({ diagnostics_enabled: true, server_fn_request: false, status: 202 })
    );
    await expect(response.text()).resolves.toBe('plain');
  });
});
