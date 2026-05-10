import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  redis: {
    get: vi.fn(),
    del: vi.fn(async () => 1),
    setex: vi.fn(async () => 'OK'),
    scan: vi.fn(async () => ['0', []]),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../redis.js', () => ({
  getRedisClient: () => state.redis,
}));

describe('redis permission snapshot server', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.REDIS_SNAPSHOT_HMAC_SECRET;
  });

  it('returns miss and evicts invalid snapshot metadata', async () => {
    const { getRedisPermissionSnapshot } = await import('./redis-permission-snapshot.server.js');

    state.redis.get.mockResolvedValueOnce(null);
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
      })
    ).resolves.toEqual({
      hit: false,
      reason: 'miss',
    });

    state.redis.get.mockResolvedValueOnce(
      JSON.stringify({
        permissions: [],
        version: 'v1',
        hmac: 'invalid',
      })
    );
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
      })
    ).resolves.toEqual({
      hit: false,
      reason: 'integrity_error',
    });

    expect(state.redis.del).toHaveBeenCalledTimes(1);
    expect(state.logger.warn).toHaveBeenCalled();
  });

  it('detects hmac mismatches and returns stored snapshots when signatures match', async () => {
    process.env.REDIS_SNAPSHOT_HMAC_SECRET = 'test-secret';
    const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } = await import('./redis-permission-snapshot.server.js');

    const permissions = [{ actionId: 'news.read', scope: 'instance' }];
    await expect(
      setRedisPermissionSnapshot(
        {
          instanceId: 'tenant-a',
          userId: 'user-1',
          organizationId: 'org-1',
          geoCtxHash: 'geo-1',
        },
        permissions as never
      )
    ).resolves.toMatchObject({
      ok: true,
      version: expect.any(String),
    });

    const [redisKey, _ttl, serialized] = state.redis.setex.mock.calls[0] as [string, number, string];
    state.redis.get.mockResolvedValueOnce(
      JSON.stringify({
        ...JSON.parse(serialized),
        hmac: 'broken',
      })
    );
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
        organizationId: 'org-1',
        geoCtxHash: 'geo-1',
      })
    ).resolves.toEqual({
      hit: false,
      reason: 'integrity_error',
    });

    state.redis.get.mockResolvedValueOnce(serialized);
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
        organizationId: 'org-1',
        geoCtxHash: 'geo-1',
      })
    ).resolves.toMatchObject({
      hit: true,
      permissions,
    });
    expect(redisKey).toContain('tenant-a:user-1');
  });

  it('returns redis_unavailable on read or write failures and invalidates matching keys', async () => {
    const {
      getRedisPermissionSnapshot,
      invalidateRedisPermissionSnapshots,
      setRedisPermissionSnapshot,
    } = await import('./redis-permission-snapshot.server.js');

    state.redis.get.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
      })
    ).resolves.toEqual({
      hit: false,
      reason: 'redis_unavailable',
    });

    state.redis.setex.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      setRedisPermissionSnapshot(
        {
          instanceId: 'tenant-a',
          userId: 'user-1',
        },
        [] as never
      )
    ).resolves.toEqual({
      ok: false,
      reason: 'redis_unavailable',
    });

    state.redis.scan
      .mockResolvedValueOnce(['1', ['key-1', 'key-2']])
      .mockResolvedValueOnce(['0', ['key-3']]);
    state.redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    await expect(invalidateRedisPermissionSnapshots('tenant-a', 'user-1')).resolves.toBe(3);
    expect(state.redis.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'perm:v1:tenant-a:user-1:*',
      'COUNT',
      100
    );

    state.redis.scan.mockRejectedValueOnce(new Error('scan failed'));
    await expect(invalidateRedisPermissionSnapshots('tenant-a')).resolves.toBe(0);
    expect(state.logger.error).toHaveBeenCalled();
  });
});
