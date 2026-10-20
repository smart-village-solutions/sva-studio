import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.REDIS_SNAPSHOT_HMAC_SECRET;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns miss and evicts invalid snapshot metadata', async () => {
    const { getRedisPermissionSnapshot } = await import('./redis-permission-snapshot.server.js');

    state.redis.get.mockResolvedValueOnce(null);
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
        instanceRevision: 1,
        userRevision: 1,
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
        instanceRevision: 1,
        userRevision: 1,
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
    const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } =
      await import('./redis-permission-snapshot.server.js');

    const permissions = [{ actionId: 'news.read', scope: 'instance' }];
    await expect(
      setRedisPermissionSnapshot(
        {
          instanceId: 'tenant-a',
          userId: 'user-1',
          organizationId: 'org-1',
          geoCtxHash: 'geo-1',
          instanceRevision: 2,
          userRevision: 3,
        },
        permissions as never
      )
    ).resolves.toMatchObject({
      ok: true,
      version: expect.any(String),
    });

    const [redisKey, _ttl, serialized] = state.redis.setex.mock.calls[0] as [
      string,
      number,
      string,
    ];
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
        instanceRevision: 2,
        userRevision: 3,
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
        instanceRevision: 2,
        userRevision: 3,
      })
    ).resolves.toMatchObject({
      hit: true,
      permissions,
    });
    expect(redisKey).toContain('tenant-a:user-1');
  });

  it.each([299_999, 300_000, 744_000])(
    'enforces logical age at %i ms without changing Redis retention',
    async (ageMs) => {
      vi.useFakeTimers();
      const createdAtMs = Date.parse('2026-10-20T10:00:00Z');
      vi.setSystemTime(createdAtMs + 20_000);
      const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } =
        await import('./redis-permission-snapshot.server.js');
      const key = {
        instanceId: 'tenant-a',
        userId: 'user-1',
        instanceRevision: 1,
        userRevision: 1,
      };
      await setRedisPermissionSnapshot(key, [], createdAtMs);
      const [, ttl, serialized] = state.redis.setex.mock.calls[0] as [string, number, string];
      expect(ttl).toBe(900);
      state.redis.get.mockResolvedValueOnce(serialized);
      vi.setSystemTime(createdAtMs + ageMs);
      const result = await getRedisPermissionSnapshot(key);
      expect(result).toMatchObject(
        ageMs < 300_000 ? { hit: true, createdAtMs } : { hit: false, reason: 'expired' }
      );
      // Expiry must not delete a newer concurrent replacement under the same revision key.
      expect(state.redis.del).not.toHaveBeenCalled();
    }
  );

  it('isolates computation-start snapshots from the legacy Redis keyspace', async () => {
    const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } =
      await import('./redis-permission-snapshot.server.js');
    const key = { instanceId: 'tenant-a', userId: 'user-1', instanceRevision: 1, userRevision: 1 };
    await setRedisPermissionSnapshot(key, []);
    const [redisKey, , serialized] = state.redis.setex.mock.calls[0] as [string, number, string];
    expect(redisKey).toBe('perm:v3:tenant-a:user-1:none:none:ir1:ur1');
    expect(JSON.parse(serialized).schema_version).toBe(3);
    state.redis.get.mockImplementationOnce(async (requestedKey: string) =>
      requestedKey.startsWith('perm:v2:') ? serialized : null
    );
    await expect(getRedisPermissionSnapshot(key)).resolves.toEqual({ hit: false, reason: 'miss' });
  });

  it('rejects a correctly signed legacy schema with post-computation timestamp semantics', async () => {
    process.env.REDIS_SNAPSHOT_HMAC_SECRET = 'test-legacy-secret';
    const { getRedisPermissionSnapshot } = await import('./redis-permission-snapshot.server.js');
    const legacy = {
      permissions: [],
      version: 'legacy',
      schema_version: 2,
      signed_at: new Date().toISOString(),
      binding: {
        instanceId: 'tenant-a',
        userId: 'user-1',
        organizationHash: 'none',
        geoContextHash: 'none',
        instanceRevision: 1,
        userRevision: 1,
      },
    };
    state.redis.get.mockResolvedValueOnce(
      JSON.stringify({
        ...legacy,
        hmac: createHmac('sha256', 'test-legacy-secret')
          .update(JSON.stringify(legacy))
          .digest('hex'),
      })
    );
    await expect(
      getRedisPermissionSnapshot({
        instanceId: 'tenant-a',
        userId: 'user-1',
        instanceRevision: 1,
        userRevision: 1,
      })
    ).resolves.toEqual({ hit: false, reason: 'integrity_error' });
  });

  it('rejects a snapshot whose Redis write exhausts its logical validity', async () => {
    vi.useFakeTimers();
    const createdAtMs = Date.parse('2026-10-20T10:00:00Z');
    vi.setSystemTime(createdAtMs);
    const { setRedisPermissionSnapshot } = await import('./redis-permission-snapshot.server.js');
    state.redis.setex.mockImplementationOnce(async () => {
      vi.setSystemTime(createdAtMs + 300_000);
      return 'OK';
    });
    await expect(
      setRedisPermissionSnapshot(
        {
          instanceId: 'tenant-a',
          userId: 'user-1',
          instanceRevision: 1,
          userRevision: 1,
        },
        []
      )
    ).resolves.toEqual({ ok: false, reason: 'snapshot_expired' });
  });

  it('rejects a signed timestamp from the future', async () => {
    vi.useFakeTimers();
    const now = Date.parse('2026-10-20T10:00:00Z');
    vi.setSystemTime(now);
    const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } =
      await import('./redis-permission-snapshot.server.js');
    const key = { instanceId: 'tenant-a', userId: 'user-1', instanceRevision: 1, userRevision: 1 };
    await setRedisPermissionSnapshot(key, []);
    state.redis.get.mockResolvedValueOnce(state.redis.setex.mock.calls[0][2]);
    vi.setSystemTime(now - 1);
    await expect(getRedisPermissionSnapshot(key)).resolves.toEqual({
      hit: false,
      reason: 'integrity_error',
    });
  });

  it('fails closed outside development and test when the HMAC secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getRedisPermissionSnapshot, setRedisPermissionSnapshot } =
      await import('./redis-permission-snapshot.server.js');
    const key = {
      instanceId: 'tenant-a',
      userId: 'user-1',
      instanceRevision: 1,
      userRevision: 1,
    };
    state.redis.get.mockResolvedValueOnce(
      JSON.stringify({
        permissions: [{ actionId: 'news.read', scope: 'instance' }],
        version: 'forged',
        schema_version: 3,
        signed_at: new Date().toISOString(),
        hmac: 'publicly-forged',
        binding: {
          instanceId: 'tenant-a',
          userId: 'user-1',
          organizationHash: 'none',
          geoContextHash: 'none',
          instanceRevision: 1,
          userRevision: 1,
        },
      })
    );

    await expect(getRedisPermissionSnapshot(key)).resolves.toEqual({
      hit: false,
      reason: 'redis_unavailable',
    });
    await expect(setRedisPermissionSnapshot(key, [])).resolves.toEqual({
      ok: false,
      reason: 'redis_unavailable',
    });
    expect(state.redis.setex).not.toHaveBeenCalled();
    expect(state.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: 'redis_snapshot_hmac_secret_missing' })
    );
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
        instanceRevision: 1,
        userRevision: 1,
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
          instanceRevision: 1,
          userRevision: 1,
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
      'perm:v3:tenant-a:user-1:*',
      'COUNT',
      100
    );

    state.redis.scan.mockRejectedValueOnce(new Error('scan failed'));
    await expect(invalidateRedisPermissionSnapshots('tenant-a')).resolves.toBe(0);
    expect(state.logger.error).toHaveBeenCalled();
  });
});
