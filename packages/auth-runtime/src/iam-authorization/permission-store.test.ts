import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRedisPermissionSnapshot: vi.fn(),
  setRedisPermissionSnapshot: vi.fn(),
  loadPermissionsFromDb: vi.fn(),
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
  loadPermissionsFromDb: mocks.loadPermissionsFromDb,
}));

vi.mock('./shared.js', () => ({
  buildRequestContext: mocks.buildRequestContext,
  cacheLogger: mocks.cacheLogger,
  cacheMetricsState: mocks.cacheMetricsState,
  ensureInvalidationListener: mocks.ensureInvalidationListener,
  iamCacheLookupCounter: mocks.iamCacheLookupCounter,
  logger: mocks.logger,
  permissionSnapshotCache: mocks.permissionSnapshotCache,
  recordPermissionCacheColdStart: mocks.recordPermissionCacheColdStart,
  recordPermissionCacheRecompute: mocks.recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency: mocks.recordPermissionCacheRedisLatency,
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
    mocks.loadPermissionsFromDb.mockResolvedValue([
      { action: 'news.read', effect: 'allow' },
    ]);
  });

  it('returns a memory-cache hit without touching redis or the database', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.permissionSnapshotCache.get.mockReturnValueOnce({
      status: 'hit',
      snapshot: {
        permissions: [{ action: 'news.read', effect: 'allow' }],
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
      permissions: [{ action: 'news.read', effect: 'allow' }],
      cacheStatus: 'hit',
      snapshotVersion: 'memory-1',
    });
    expect(mocks.getRedisPermissionSnapshot).not.toHaveBeenCalled();
    expect(mocks.loadPermissionsFromDb).not.toHaveBeenCalled();
  });

  it('hydrates the in-memory cache from a redis hit', async () => {
    const { resolveEffectivePermissions } = await import('./permission-store.js');

    mocks.getRedisPermissionSnapshot.mockResolvedValueOnce({
      hit: true,
      permissions: [{ action: 'events.read', effect: 'allow' }],
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
      permissions: [{ action: 'events.read', effect: 'allow' }],
      cacheStatus: 'hit',
      snapshotVersion: 'memory-2',
    });
    expect(mocks.permissionSnapshotCache.set).toHaveBeenCalledTimes(1);
    expect(mocks.loadPermissionsFromDb).not.toHaveBeenCalled();
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
    mocks.loadPermissionsFromDb.mockResolvedValueOnce([
      { action: 'locations.manage', effect: 'allow' },
    ]);
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
      permissions: [{ action: 'locations.manage', effect: 'allow' }],
      cacheStatus: 'recompute',
      snapshotVersion: 'memory-3',
    });
    expect(mocks.recordPermissionCacheRecompute).toHaveBeenCalledTimes(1);
    expect(mocks.cacheLogger.info).toHaveBeenCalledWith(
      'Permission snapshot recomputed after stale detection',
      expect.objectContaining({ operation: 'cache_invalidate', trigger: 'recompute' })
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
});
