import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opentelemetry/api', () => ({
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
    }),
  },
  trace: {
    getTracer: () => ({
      startActiveSpan: async (_name: string, callback: (span: { setAttributes: (attrs: Record<string, unknown>) => void; setStatus: (status: Record<string, unknown>) => void; recordException: (error: unknown) => void; end: () => void; }) => Promise<unknown>) =>
        callback({
          setAttributes: () => undefined,
          setStatus: () => undefined,
          recordException: () => undefined,
          end: () => undefined,
        }),
    }),
  },
}));

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/sdk/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/sdk/server')>();

  return {
    ...actual,
    createSdkLogger: () => state.logger,
    getWorkspaceContext: () => ({
      requestId: 'req-mainserver',
      traceId: 'trace-mainserver',
      workspaceId: 'de-musterhausen',
    }),
    initializeOtelSdk: async () => undefined,
  };
});

describe('SVA Mainserver logging', () => {
  beforeEach(() => {
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
  });

  afterEach(async () => {
    vi.resetModules();
    const { resetSvaMainserverServiceState } = await import('./service');
    resetSvaMainserverServiceState();
  });

  it('emits cache logs with workspace_id on repeated credential access', async () => {
    const { createSvaMainserverService } = await import('./service');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 120 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockImplementation(async () =>
        new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const service = createSvaMainserverService({
      loadInstanceConfig: async () => ({
        instanceId: 'de-musterhausen',
        providerKey: 'sva_mainserver',
        graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
        oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
        enabled: true,
      }),
      readCredentials: async () => ({
        apiKey: 'key-1',
        apiSecret: 'secret-1',
      }),
      fetchImpl,
    });

    await service.getQueryRootTypename({ instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' });
    await service.getQueryRootTypename({ instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' });

    expect(state.logger.debug).toHaveBeenCalledWith(
      'SVA Mainserver credential cache hit',
      expect.objectContaining({
        workspace_id: 'de-musterhausen',
        operation: 'load_credentials',
        cache: 'hit',
      })
    );
  });
});
