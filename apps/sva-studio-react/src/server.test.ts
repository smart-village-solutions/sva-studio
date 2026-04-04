import { afterEach, describe, expect, it, vi } from 'vitest';

const createStartHandlerMock = vi.fn();
const createSdkLoggerMock = vi.fn();
const getWorkspaceContextMock = vi.fn();
const withRequestContextMock = vi.fn();
const createServerFunctionRequestDiagnosticsMock = vi.fn();
const readServerFunctionResponseBodyForDiagnosticsMock = vi.fn();
const resolveServerFunctionBranchDecisionMock = vi.fn();

vi.mock('@tanstack/react-start/server', () => ({
  createStartHandler: createStartHandlerMock,
  defaultStreamHandler: {},
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: createSdkLoggerMock,
  getWorkspaceContext: getWorkspaceContextMock,
  withRequestContext: withRequestContextMock,
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
    getWorkspaceContextMock.mockReset();
    withRequestContextMock.mockReset();
    createServerFunctionRequestDiagnosticsMock.mockReset();
    readServerFunctionResponseBodyForDiagnosticsMock.mockReset();
    resolveServerFunctionBranchDecisionMock.mockReset();
  });

  it('routes auth requests through TanStack Start instead of a manual auth bypass', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const startFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    createStartHandlerMock.mockReturnValue(startFetch);

    const mod = await import('./server');
    const response = await mod.default.fetch(new Request('http://localhost:3000/auth/login'));

    expect(startFetch).toHaveBeenCalledTimes(1);
    expect(startFetch).toHaveBeenCalledWith(expect.any(Request), undefined);
    await expect(response.text()).resolves.toBe('ok');
  });

  it('bypasses diagnostics for non server-function requests in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const startFetch = vi.fn().mockResolvedValue(new Response('plain', { status: 200 }));
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
});
