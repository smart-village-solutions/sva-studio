import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  gaugeCallback: null as null | ((result: { observe: (value: number) => void }) => void),
  notificationHandler: null as null | ((message: { payload?: string }) => void),
  queryImpl: null as null | ((text: string, values?: readonly unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    requestId: 'req-shared-listener',
    traceId: 'trace-shared-listener',
  }),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableGauge: () => ({
        addCallback: (callback: (result: { observe: (value: number) => void }) => void) => {
          state.gaugeCallback = callback;
        },
      }),
    }),
  },
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    public async connect() {
      return {
        query: async (text: string, values?: readonly unknown[]) => {
          if (state.queryImpl) {
            return state.queryImpl(text, values);
          }
          return { rowCount: 0, rows: [] };
        },
        on: (event: string, listener: (message: { payload?: string }) => void) => {
          if (event === 'notification') {
            state.notificationHandler = listener;
          }
        },
        release: () => undefined,
      };
    }
  },
}));

describe('iam authorization invalidation listener', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.IAM_DATABASE_URL;
    state.gaugeCallback = null;
    state.notificationHandler = null;
    state.queryImpl = null;
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
  });

  it('observes stale cache ratio from gauge state', async () => {
    const { cacheMetricsState } = await import('./iam-authorization/shared');

    cacheMetricsState.lookups = 4;
    cacheMetricsState.staleLookups = 1;

    const observe = vi.fn();
    state.gaugeCallback?.({ observe });

    expect(observe).toHaveBeenCalledWith(0.25);
  });

  it('returns early when the IAM database is not configured', async () => {
    const { ensureInvalidationListener } = await import('./iam-authorization/shared');

    await expect(ensureInvalidationListener()).resolves.toBeUndefined();

    expect(state.logger.info).not.toHaveBeenCalled();
    expect(state.notificationHandler).toBeNull();
  });

  it('logs invalid payloads and invalidates cached entries for valid notifications', async () => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    state.queryImpl = async () => ({ rowCount: 0, rows: [] });

    const { ensureInvalidationListener, permissionSnapshotCache } = await import('./iam-authorization/shared');

    permissionSnapshotCache.set(
      {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'keycloak-subject-1',
      },
      { permissions: [], staleAt: Date.now() + 60_000 }
    );

    await ensureInvalidationListener();

    state.notificationHandler?.({ payload: '{"broken":true}' });
    state.notificationHandler?.({
      payload: JSON.stringify({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'keycloak-subject-1',
        trigger: 'pg_notify',
      }),
    });

    expect(state.logger.warn).toHaveBeenCalledWith(
      'Cache invalidation payload could not be parsed',
      expect.objectContaining({
        operation: 'cache_invalidate_failed',
      })
    );
    expect(state.logger.info).toHaveBeenLastCalledWith(
      'Cache invalidation event received',
      expect.objectContaining({
        operation: 'cache_invalidate',
        trigger: 'pg_notify',
      })
    );
    expect(
      permissionSnapshotCache.get({
        instanceId: 'de-musterhausen',
        keycloakSubject: 'keycloak-subject-1',
      })
    ).toEqual({ status: 'miss' });
  });

  it('returns null when authorize requests contain invalid json', async () => {
    const { loadAuthorizeRequest } = await import('./iam-authorization/shared');

    const request = new Request('http://localhost/iam/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    });

    await expect(loadAuthorizeRequest(request)).resolves.toBeNull();
  });
});
