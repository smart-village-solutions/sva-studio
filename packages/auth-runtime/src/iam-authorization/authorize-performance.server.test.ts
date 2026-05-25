import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  authorizeHandler: vi.fn(),
  invalidateRedisPermissionSnapshots: vi.fn(async () => undefined),
  permissionSnapshotInvalidate: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: state.mkdir,
  writeFile: state.writeFile,
}));

vi.mock('./authorize.js', () => ({
  authorizeHandler: state.authorizeHandler,
}));

vi.mock('./redis-permission-snapshot.server.js', () => ({
  invalidateRedisPermissionSnapshots: state.invalidateRedisPermissionSnapshots,
}));

vi.mock('./shared.js', () => ({
  permissionSnapshotCache: {
    invalidate: state.permissionSnapshotInvalidate,
  },
}));

describe('authorize-performance.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('runs all scenarios, writes reports and caches the latest benchmark by actor', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 5;
      return now;
    });

    state.authorizeHandler.mockImplementation(async (request: Request) => {
      const payload = (await request.json()) as { context?: { requestId?: string } };
      const requestId = payload.context?.requestId ?? '';
      const cacheStatus =
        requestId.includes('-cache-hit-')
          ? 'hit'
          : requestId.includes('-cache-miss-')
            ? 'miss'
            : 'recomputed';

      return new Response(JSON.stringify({ cacheStatus }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { readLatestAuthorizePerformanceBenchmark, runAuthorizePerformanceBenchmark } = await import(
      './authorize-performance.server.js'
    );

    const result = await runAuthorizePerformanceBenchmark({
      actor: {
        id: 'kc-user-1',
        instanceId: 'tenant-1',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
        organizationId: 'org-1',
        measuredRequests: 2,
        warmupRequests: 2,
      },
      requestHeaders: new Headers({
        cookie: 'sid=abc',
        authorization: 'Bearer token',
        traceparent: '00-abc-123-01',
      }),
      requestUrl: 'https://studio.test/api/v1',
    });

    expect(result.configuration).toEqual({
      measuredRequests: 2,
      warmupRequests: 2,
    });
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios.map((scenario) => scenario.scenario)).toEqual([
      'cache-hit',
      'cache-miss',
      'recompute',
    ]);
    expect(result.scenarios.map((scenario) => scenario.evaluation)).toEqual([
      'accepted',
      'accepted',
      'accepted',
    ]);
    expect(result.scenarios[0]?.observedCacheStatuses).toEqual(['hit', 'hit']);
    expect(result.scenarios[1]?.observedCacheStatuses).toEqual(['miss', 'miss']);
    expect(result.scenarios[2]?.observedCacheStatuses).toEqual(['recomputed', 'recomputed']);
    expect(result.report?.jsonPath).toContain('docs/reports/iam-authorize-performance-');
    expect(result.report?.markdownPath).toContain('docs/reports/iam-authorize-performance-');

    expect(state.authorizeHandler).toHaveBeenCalledTimes(12);
    expect(state.permissionSnapshotInvalidate).toHaveBeenCalledTimes(4);
    expect(state.invalidateRedisPermissionSnapshots).toHaveBeenCalledTimes(4);
    expect(state.mkdir).toHaveBeenCalledTimes(1);
    expect(state.writeFile).toHaveBeenCalledTimes(2);

    const latest = readLatestAuthorizePerformanceBenchmark({
      instanceId: 'tenant-1',
      keycloakSubject: 'kc-user-1',
    });
    expect(latest).toEqual(result);
    expect(
      readLatestAuthorizePerformanceBenchmark({
        instanceId: 'tenant-1',
        keycloakSubject: 'unknown',
      })
    ).toBeNull();
  });

  it('fails when cache-hit samples return an unexpected cache status', async () => {
    state.authorizeHandler.mockResolvedValue(
      new Response(JSON.stringify({ cacheStatus: 'miss' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { runAuthorizePerformanceBenchmark } = await import('./authorize-performance.server.js');

    await expect(
      runAuthorizePerformanceBenchmark({
        actor: {
          id: 'kc-user-2',
          instanceId: 'tenant-1',
        },
        request: {
          action: 'content.read',
          resourceType: 'content',
          measuredRequests: 1,
          warmupRequests: 0,
        },
        requestHeaders: new Headers(),
        requestUrl: 'https://studio.test/api/v1',
      })
    ).rejects.toThrowError('scenario:cache-hit:unexpected_cache_status');
  });

  it('expires cached benchmark results after the ttl window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    state.authorizeHandler.mockImplementation(
      async () =>
        new Response(JSON.stringify({ cacheStatus: 'hit' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const { readLatestAuthorizePerformanceBenchmark, runAuthorizePerformanceBenchmark } = await import(
      './authorize-performance.server.js'
    );

    await runAuthorizePerformanceBenchmark({
      actor: {
        id: 'kc-user-ttl',
        instanceId: 'tenant-1',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
        measuredRequests: 1,
        warmupRequests: 0,
      },
      requestHeaders: new Headers(),
      requestUrl: 'https://studio.test/api/v1',
    });

    expect(
      readLatestAuthorizePerformanceBenchmark({
        instanceId: 'tenant-1',
        keycloakSubject: 'kc-user-ttl',
      })
    ).not.toBeNull();

    vi.spyOn(Date, 'now').mockReturnValue(1_000 + 15 * 60 * 1000 + 1);
    expect(
      readLatestAuthorizePerformanceBenchmark({
        instanceId: 'tenant-1',
        keycloakSubject: 'kc-user-ttl',
      })
    ).toBeNull();
  });
});
