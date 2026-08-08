import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRedisPermissionSnapshot: vi.fn(),
  setRedisPermissionSnapshot: vi.fn(),
  loadPermissionsWithClient: vi.fn(),
  readPermissionRevisionVector: vi.fn(),
  readPermissionRevisionVectorWithClient: vi.fn(),
  withInstanceScopedDb: vi.fn(
    async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})
  ),
  ensureInvalidationListener: vi.fn(),
  buildRequestContext: vi.fn(() => ({ trace_id: 'trace-test' })),
  cacheLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  logger: {
    error: vi.fn(),
  },
  iamCacheLookupCounter: {
    add: vi.fn(),
  },
  iamPermissionCacheLifecycleCounter: {
    add: vi.fn(),
  },
  iamPermissionRevisionReadLatencyHistogram: {
    record: vi.fn(),
  },
  cacheMetricsState: {
    lookups: 0,
    staleLookups: 0,
  },
  recordPermissionCacheColdStart: vi.fn(),
  recordPermissionCacheRecompute: vi.fn(),
  recordPermissionCacheRedisLatency: vi.fn(),
  permissionSnapshotCache: {
    get: vi.fn(),
    set: vi.fn(),
    size: vi.fn(),
  },
}));

vi.mock('./redis-permission-snapshot.server.js', () => ({
  getRedisPermissionSnapshot: mocks.getRedisPermissionSnapshot,
  setRedisPermissionSnapshot: mocks.setRedisPermissionSnapshot,
}));

vi.mock('./permission-store.queries.js', () => ({
  loadPermissionsWithClient: mocks.loadPermissionsWithClient,
}));

vi.mock('./permission-revision-store.js', () => ({
  readPermissionRevisionVector: mocks.readPermissionRevisionVector,
  readPermissionRevisionVectorWithClient: mocks.readPermissionRevisionVectorWithClient,
}));

vi.mock('./shared.js', () => ({
  buildRequestContext: mocks.buildRequestContext,
  cacheLogger: mocks.cacheLogger,
  cacheMetricsState: mocks.cacheMetricsState,
  ensureInvalidationListener: mocks.ensureInvalidationListener,
  iamCacheLookupCounter: mocks.iamCacheLookupCounter,
  iamPermissionCacheLifecycleCounter: mocks.iamPermissionCacheLifecycleCounter,
  iamPermissionRevisionReadLatencyHistogram: mocks.iamPermissionRevisionReadLatencyHistogram,
  logger: mocks.logger,
  permissionSnapshotCache: mocks.permissionSnapshotCache,
  recordPermissionCacheColdStart: mocks.recordPermissionCacheColdStart,
  recordPermissionCacheRecompute: mocks.recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency: mocks.recordPermissionCacheRedisLatency,
  withInstanceScopedDb: mocks.withInstanceScopedDb,
}));

describe('resolveEffectivePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheMetricsState.lookups = 0;
    mocks.cacheMetricsState.staleLookups = 0;
    mocks.ensureInvalidationListener.mockResolvedValue(undefined);
    mocks.permissionSnapshotCache.size.mockReturnValue(1);
    mocks.permissionSnapshotCache.get.mockReturnValue({
      status: 'miss',
    });
    mocks.permissionSnapshotCache.set.mockReturnValue({
      snapshotVersion: 'snap-1',
    });
    mocks.getRedisPermissionSnapshot.mockResolvedValue({
      hit: false,
      reason: 'miss',
    });
    mocks.setRedisPermissionSnapshot.mockResolvedValue({
      ok: true,
      version: 'redis-1',
    });
    mocks.readPermissionRevisionVector.mockResolvedValue({ instanceRevision: 3, userRevision: 7 });
    mocks.readPermissionRevisionVectorWithClient.mockResolvedValue({
      instanceRevision: 3,
      userRevision: 7,
    });
    mocks.loadPermissionsWithClient.mockResolvedValue([{ action: 'news.read' }]);
  });

  it('returns a memory-cache hit without touching redis or the database', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.permissionSnapshotCache.get.mockReturnValueOnce({
      status: 'hit',
      snapshot: {
        permissions: [{ action: 'news.read' }],
        snapshotVersion: 'memory-1',
      },
      ttlRemainingSeconds: 42,
    });

    const result = await resolveEffectivePermissions({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
    });

    expect(result).toEqual({
      ok: true,
      permissions: [{ action: 'news.read' }],
      cacheStatus: 'hit',
      snapshotVersion: 'memory-1',
      permissionRevision: { instanceRevision: 3, userRevision: 7 },
    });
    expect(mocks.getRedisPermissionSnapshot).not.toHaveBeenCalled();
    expect(mocks.loadPermissionsWithClient).not.toHaveBeenCalled();
    expect(mocks.readPermissionRevisionVector).toHaveBeenCalledTimes(1);
  });

  it('fails closed before cache lookup when the authoritative revision read fails', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');
    mocks.readPermissionRevisionVector.mockRejectedValueOnce(new Error('database offline'));

    await expect(
      resolveEffectivePermissions({ instanceId: 'de-test', keycloakSubject: 'kc-user-1' })
    ).resolves.toEqual({ ok: false, error: 'database_unavailable' });
    expect(mocks.permissionSnapshotCache.get).not.toHaveBeenCalled();
    expect(mocks.getRedisPermissionSnapshot).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Permission revision read failed',
      expect.objectContaining({ operation: 'revision_read_failed', error: 'database offline' })
    );
  });

  it('hydrates the in-memory cache from a redis hit', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.getRedisPermissionSnapshot.mockResolvedValueOnce({
      hit: true,
      permissions: [{ action: 'events.read' }],
      version: 'redis-2',
    });
    mocks.permissionSnapshotCache.set.mockReturnValueOnce({
      snapshotVersion: 'memory-2',
    });

    const result = await resolveEffectivePermissions({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
      organizationId: 'org-1',
    });

    expect(result).toEqual({
      ok: true,
      permissions: [{ action: 'events.read' }],
      cacheStatus: 'hit',
      snapshotVersion: 'memory-2',
      permissionRevision: { instanceRevision: 3, userRevision: 7 },
    });
    expect(mocks.permissionSnapshotCache.set).toHaveBeenCalledTimes(1);
    expect(mocks.loadPermissionsWithClient).not.toHaveBeenCalled();
  });

  it('fails closed when redis is unavailable', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.getRedisPermissionSnapshot.mockResolvedValueOnce({
      hit: false,
      reason: 'redis_unavailable',
    });

    const result = await resolveEffectivePermissions({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
    });

    expect(result).toEqual({ ok: false, error: 'database_unavailable' });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Redis permission snapshot lookup failed',
      expect.objectContaining({ operation: 'cache_lookup_failed', error: 'redis_unavailable' })
    );
  });

  it('recomputes stale snapshots from the database and reports recompute status', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.permissionSnapshotCache.get.mockReturnValueOnce({
      status: 'stale',
      ageSeconds: 600,
    });
    mocks.loadPermissionsWithClient.mockResolvedValueOnce([{ action: 'locations.manage' }]);
    mocks.setRedisPermissionSnapshot.mockResolvedValueOnce({
      ok: true,
      version: 'redis-3',
    });
    mocks.permissionSnapshotCache.set.mockReturnValueOnce({
      snapshotVersion: 'memory-3',
    });

    const result = await resolveEffectivePermissions({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
      geoUnitId: 'geo-1',
      geoHierarchy: ['geo-1', 'geo-1', 'geo-2'],
    });

    expect(result).toEqual({
      ok: true,
      permissions: [{ action: 'locations.manage' }],
      cacheStatus: 'recompute',
      snapshotVersion: 'memory-3',
      permissionRevision: { instanceRevision: 3, userRevision: 7 },
    });
    expect(mocks.recordPermissionCacheRecompute).toHaveBeenCalledTimes(1);
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith(
      'Permission snapshot recomputed after stale detection',
      expect.objectContaining({ operation: 'cache_invalidate', trigger: 'recompute' })
    );
  });

  it('discards stale recomputes and retries against the new revision', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.readPermissionRevisionVector
      .mockResolvedValueOnce({ instanceRevision: 3, userRevision: 7 })
      .mockResolvedValueOnce({ instanceRevision: 3, userRevision: 8 })
      .mockResolvedValueOnce({ instanceRevision: 3, userRevision: 8 });
    mocks.readPermissionRevisionVectorWithClient
      .mockResolvedValueOnce({ instanceRevision: 3, userRevision: 8 })
      .mockResolvedValueOnce({ instanceRevision: 3, userRevision: 8 });
    mocks.loadPermissionsWithClient.mockResolvedValueOnce([{ action: 'news.update' }]);

    await expect(
      resolveEffectivePermissions({ instanceId: 'de-test', keycloakSubject: 'kc-user-1' })
    ).resolves.toEqual({
      ok: true,
      permissions: [{ action: 'news.update' }],
      cacheStatus: 'miss',
      snapshotVersion: 'snap-1',
      permissionRevision: { instanceRevision: 3, userRevision: 8 },
    });
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith(
      'Stale permission recompute discarded',
      expect.objectContaining({ operation: 'stale_write_discarded', attempt: 0 })
    );
  });

  it('fails closed when redis snapshot writes fail after recompute', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.setRedisPermissionSnapshot.mockResolvedValueOnce({
      ok: false,
      reason: 'redis_unavailable',
    });

    const result = await resolveEffectivePermissions({
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
    });

    expect(result).toEqual({ ok: false, error: 'database_unavailable' });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Redis permission snapshot write failed after recompute',
      expect.objectContaining({ operation: 'cache_store_failed', error: 'redis_unavailable' })
    );
  });

  it('coalesces identical concurrent recomputes within one replica', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');
    let releaseLoad: (() => void) | undefined;
    mocks.loadPermissionsWithClient.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseLoad = () => resolve([{ action: 'news.read' }]);
        })
    );
    const input = { instanceId: 'de-test', keycloakSubject: 'kc-user-1' };

    const first = resolveEffectivePermissions(input);
    const second = resolveEffectivePermissions(input);
    await vi.waitFor(() => expect(mocks.loadPermissionsWithClient).toHaveBeenCalledTimes(1));
    releaseLoad?.();

    const results = await Promise.all([first, second]);
    expect(results).toEqual([
      expect.objectContaining({ ok: true, permissions: [{ action: 'news.read' }] }),
      expect.objectContaining({ ok: true, permissions: [{ action: 'news.read' }] }),
    ]);
    expect(mocks.loadPermissionsWithClient).toHaveBeenCalledTimes(1);
  });
});
