import { afterEach, describe, expect, it, vi } from 'vitest';

const createStartHandlerMock = vi.fn();
const createSdkLoggerMock = vi.fn();
const dispatchAuthRouteRequestMock = vi.fn();
const dispatchMainserverNewsRequestMock = vi.fn();
const dispatchMainserverEventsRequestMock = vi.fn();
const dispatchMainserverPoiRequestMock = vi.fn();
const dispatchMainserverSurveysRequestMock = vi.fn();
const dispatchMainserverCategoriesRequestMock = vi.fn();
const dispatchAggregatedContentListRequestMock = vi.fn();
const dispatchMapGeocodingRequestMock = vi.fn();
const ensurePluginOperationWorkerStartedMock = vi.fn();
const getWorkspaceContextMock = vi.fn();
const withRequestContextMock = vi.fn();
const createServerFunctionRequestDiagnosticsMock = vi.fn();
const readServerFunctionResponseBodyForDiagnosticsMock = vi.fn();
const resolveServerFunctionBranchDecisionMock = vi.fn();
const registerStudioPluginOperationHandlersMock = vi.fn();

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

vi.mock('@sva/auth-runtime/server', () => ({
  ensureStudioJobWorkerStarted: ensurePluginOperationWorkerStartedMock,
  ensurePluginOperationWorkerStarted: ensurePluginOperationWorkerStartedMock,
}));

vi.mock('./lib/mainserver-news-api.server', () => ({
  dispatchMainserverNewsRequest: dispatchMainserverNewsRequestMock,
}));

vi.mock('./lib/mainserver-events-api.server', () => ({
  dispatchMainserverEventsRequest: dispatchMainserverEventsRequestMock,
}));

vi.mock('./lib/mainserver-poi-api.server', () => ({
  dispatchMainserverPoiRequest: dispatchMainserverPoiRequestMock,
}));

vi.mock('./lib/mainserver-surveys-api.server', () => ({
  dispatchMainserverSurveysRequest: dispatchMainserverSurveysRequestMock,
}));

vi.mock('./lib/mainserver-categories-api.server', () => ({
  dispatchMainserverCategoriesRequest: dispatchMainserverCategoriesRequestMock,
}));

vi.mock('./lib/iam-content-list-api.server', () => ({
  dispatchAggregatedContentListRequest: dispatchAggregatedContentListRequestMock,
}));

vi.mock('./lib/map-geocoding-api.server', () => ({
  dispatchMapGeocodingRequest: dispatchMapGeocodingRequestMock,
}));

vi.mock('./lib/server-function-request-diagnostics.server', () => ({
  createServerFunctionRequestDiagnostics: createServerFunctionRequestDiagnosticsMock,
  normalizeServerFnBase: vi.fn(() => '/_server'),
  readServerFunctionResponseBodyForDiagnostics: readServerFunctionResponseBodyForDiagnosticsMock,
  resolveServerFunctionBranchDecision: resolveServerFunctionBranchDecisionMock,
}));

vi.mock('./lib/plugin-operation-runtime.server', () => ({
  registerStudioPluginOperationHandlers: registerStudioPluginOperationHandlersMock,
}));

describe('server transport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createStartHandlerMock.mockReset();
    createSdkLoggerMock.mockReset();
    dispatchAuthRouteRequestMock.mockReset();
    dispatchMainserverNewsRequestMock.mockReset();
    dispatchMainserverEventsRequestMock.mockReset();
    dispatchMainserverPoiRequestMock.mockReset();
    dispatchMainserverSurveysRequestMock.mockReset();
    dispatchMainserverCategoriesRequestMock.mockReset();
    dispatchAggregatedContentListRequestMock.mockReset();
    dispatchMapGeocodingRequestMock.mockReset();
    ensurePluginOperationWorkerStartedMock.mockReset();
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    getWorkspaceContextMock.mockReset();
    withRequestContextMock.mockReset();
    createServerFunctionRequestDiagnosticsMock.mockReset();
    readServerFunctionResponseBodyForDiagnosticsMock.mockReset();
    resolveServerFunctionBranchDecisionMock.mockReset();
    registerStudioPluginOperationHandlersMock.mockReset();
  });

  it('bypasses auth requests before TanStack Start', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchMainserverCategoriesRequestMock.mockResolvedValue(null);
    dispatchAggregatedContentListRequestMock.mockResolvedValue(null);
    dispatchMapGeocodingRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(new Response('auth', { status: 200 }));
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/auth/login'));

    expect(registerStudioPluginOperationHandlersMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).toHaveBeenCalledTimes(1);
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('auth');
  });

  it('bypasses mainserver news requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(new Response('news', { status: 200 }));
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/api/v1/mainserver/news'));

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('news');
  });

  it('bypasses mainserver events requests before poi and auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(new Response('events', { status: 200 }));
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/api/v1/mainserver/events'));

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverEventsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverPoiRequestMock).not.toHaveBeenCalled();
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('events');
  });

  it('bypasses mainserver poi requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(new Response('poi', { status: 200 }));
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/api/v1/mainserver/poi'));

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverEventsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverPoiRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('poi');
  });

  it('bypasses mainserver categories requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchMainserverCategoriesRequestMock.mockResolvedValue(
      new Response('categories', { status: 200 })
    );
    dispatchAggregatedContentListRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(
      new Request('http://localhost:3000/api/v1/mainserver/categories')
    );

    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverEventsRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverPoiRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchMainserverCategoriesRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAggregatedContentListRequestMock).not.toHaveBeenCalled();
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('categories');
  });

  it('bypasses map geocoding requests before auth routing', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchMainserverCategoriesRequestMock.mockResolvedValue(null);
    dispatchAggregatedContentListRequestMock
      .mockResolvedValueOnce(new Response('contents', { status: 200 }))
      .mockResolvedValueOnce(null);
    dispatchMapGeocodingRequestMock.mockResolvedValue(new Response('map', { status: 200 }));
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const aggregatedResponse = await mod.default.fetch(
      new Request('http://localhost:3000/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );
    const response = await mod.default.fetch(
      new Request('http://localhost:3000/api/v1/iam/map-geocoding/config')
    );

    expect(dispatchAggregatedContentListRequestMock).toHaveBeenCalledTimes(2);
    await expect(aggregatedResponse.text()).resolves.toBe('contents');
    expect(dispatchMainserverNewsRequestMock).toHaveBeenCalledTimes(2);
    expect(dispatchMainserverEventsRequestMock).toHaveBeenCalledTimes(2);
    expect(dispatchMainserverPoiRequestMock).toHaveBeenCalledTimes(2);
    expect(dispatchMainserverCategoriesRequestMock).toHaveBeenCalledTimes(2);
    expect(dispatchMapGeocodingRequestMock).toHaveBeenCalledTimes(1);
    expect(dispatchAuthRouteRequestMock).not.toHaveBeenCalled();
    expect(startFetch).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe('map');
  });

  it('bypasses diagnostics for non server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(new Response('plain', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
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

  it('refreshes plugin operation handlers on subsequent development requests without restarting the worker', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(new Response('plain', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchMainserverCategoriesRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    withRequestContextMock.mockImplementation(async (_input, callback) => callback());
    getWorkspaceContextMock.mockReturnValue({ requestId: 'req-refresh' });
    createSdkLoggerMock.mockReturnValue({ info: vi.fn() });
    createServerFunctionRequestDiagnosticsMock.mockReturnValue({
      isServerFnRequest: false,
      requestId: 'req-refresh',
    });

    const mod = await import('./server');

    await mod.default.fetch(new Request('http://localhost:3000/admin/users'));
    await Promise.resolve();
    const registrationCountAfterFirstRequest = registerStudioPluginOperationHandlersMock.mock.calls.length;
    await mod.default.fetch(new Request('http://localhost:3000/admin/users?page=2'));
    await Promise.resolve();

    expect(registrationCountAfterFirstRequest).toBeGreaterThanOrEqual(1);
    expect(registerStudioPluginOperationHandlersMock.mock.calls.length).toBeGreaterThan(
      registrationCountAfterFirstRequest
    );
    expect(ensurePluginOperationWorkerStartedMock).toHaveBeenCalledTimes(1);
    expect(startFetch).toHaveBeenCalledTimes(2);
  });

  it('logs routed server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    ensurePluginOperationWorkerStartedMock.mockResolvedValue(undefined);
    const logger = { info: vi.fn() };
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
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
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
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
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
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

  it('does not block request handling on plugin worker bootstrap', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    ensurePluginOperationWorkerStartedMock.mockImplementation(() => new Promise(() => undefined));
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const responsePromise = mod.default.fetch(new Request('http://localhost:3000/admin/users'));

    await expect(responsePromise).resolves.toBeInstanceOf(Response);
    expect(startFetch).toHaveBeenCalledTimes(1);
  });

  it('waits for plugin operation handlers before dispatching auth routes', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    let resolveHandlerRegistration: (() => void) | undefined;
    const handlerRegistrationPromise = new Promise<void>((resolve) => {
      resolveHandlerRegistration = resolve;
    });
    const authResponse = new Response('auth', { status: 200 });

    registerStudioPluginOperationHandlersMock.mockImplementation(() => handlerRegistrationPromise);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(authResponse);
    createStartHandlerMock.mockReturnValue(vi.fn().mockResolvedValue(new Response('start', { status: 200 })));

    const mod = await import('./server');
    const responsePromise = mod.default.fetch(new Request('http://localhost:3000/api/v1/plugin-operations/jobs'));

    const requestStateBeforeRegistration = await Promise.race([
      Promise.resolve(responsePromise).then(() => 'resolved'),
      new Promise<'pending'>((resolve) => {
        setTimeout(() => resolve('pending'), 0);
      }),
    ]);

    expect(requestStateBeforeRegistration).toBe('pending');

    resolveHandlerRegistration?.();

    await expect(responsePromise).resolves.toBe(authResponse);
    expect(dispatchAuthRouteRequestMock).toHaveBeenCalledTimes(1);
  });

  it('does not register plugin operation handlers when the runtime flag disables the worker', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_PLUGIN_OPERATION_WORKER_ENABLED', 'false');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    registerStudioPluginOperationHandlersMock.mockRejectedValue(new Error('missing runtime requirement'));
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/admin/users'));

    await expect(response.text()).resolves.toBe('ok');
    expect(ensurePluginOperationWorkerStartedMock).not.toHaveBeenCalled();
    expect(registerStudioPluginOperationHandlersMock).not.toHaveBeenCalled();
  });

  it('retries plugin operation handler registration after a transient import-time failure', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('first', { status: 200 }))
      .mockResolvedValueOnce(new Response('second', { status: 200 }));
    const logger = { info: vi.fn() };
    const registrationError = new Error('missing runtime requirement');

    registerStudioPluginOperationHandlersMock
      .mockRejectedValueOnce(registrationError)
      .mockResolvedValueOnce(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    createSdkLoggerMock.mockReturnValue(logger);

    const mod = await import('./server');

    const firstResponse = await mod.default.fetch(new Request('http://localhost:3000/admin/users'));
    const secondResponse = await mod.default.fetch(new Request('http://localhost:3000/admin/groups'));

    await expect(firstResponse.text()).resolves.toBe('first');
    await expect(secondResponse.text()).resolves.toBe('second');
    expect(registerStudioPluginOperationHandlersMock).toHaveBeenCalledTimes(2);
    expect(ensurePluginOperationWorkerStartedMock).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Plugin worker bootstrap failed',
      expect.objectContaining({
        operation: 'plugin_operation_worker_bootstrap',
        error: 'missing runtime requirement',
      })
    );
  });

  it('retries worker bootstrap after a transient startup failure and logs the failure', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('first', { status: 200 }))
      .mockResolvedValueOnce(new Response('second', { status: 200 }));
    const logger = { info: vi.fn() };
    const bootstrapError = new Error('database unavailable');
    ensurePluginOperationWorkerStartedMock
      .mockRejectedValueOnce(bootstrapError)
      .mockResolvedValueOnce(undefined);
    dispatchMainserverNewsRequestMock.mockResolvedValue(null);
    dispatchMainserverEventsRequestMock.mockResolvedValue(null);
    dispatchMainserverPoiRequestMock.mockResolvedValue(null);
    dispatchMainserverSurveysRequestMock.mockResolvedValue(null);
    dispatchAuthRouteRequestMock.mockResolvedValue(null);
    createStartHandlerMock.mockReturnValue(startFetch);
    createSdkLoggerMock.mockReturnValue(logger);

    const mod = await import('./server');

    const firstResponse = await mod.default.fetch(new Request('http://localhost:3000/admin/users'));
    const secondResponse = await mod.default.fetch(new Request('http://localhost:3000/admin/groups'));

    await expect(firstResponse.text()).resolves.toBe('first');
    await expect(secondResponse.text()).resolves.toBe('second');
    expect(ensurePluginOperationWorkerStartedMock).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'Plugin worker bootstrap failed',
      expect.objectContaining({
        operation: 'plugin_operation_worker_bootstrap',
        error: 'database unavailable',
      })
    );
  });
});
