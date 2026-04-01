import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
  withRequestContext: (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

// Redis-Fake — wird vor dem Import gesetzt
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock('../redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

import {
  getRedisPermissionSnapshot,
  invalidateRedisPermissionSnapshots,
  setRedisPermissionSnapshot,
} from './redis-permission-snapshot.server';
import type { PermSnapshotKey } from './redis-permission-snapshot.server';

const baseKey: PermSnapshotKey = {
  instanceId: 'inst-test',
  userId: 'user-test',
};

/** Erstellt eine gültige gespeicherte HMAC-Payload für den Get-Test. */
const makeValidStoredSnapshot = async (permissions = [{ resource: 'articles', action: 'read', effect: 'allow' as const }]) => {
  // Wir rufen zuerst set auf, dann lesen wir was gespeichert wurde
  mockRedis.setex.mockResolvedValueOnce('OK');
  await setRedisPermissionSnapshot(baseKey, permissions);
  const storedArg = mockRedis.setex.mock.calls[0]![2] as string;
  return storedArg;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Standard-Umgebung zurücksetzen
  process.env.REDIS_SNAPSHOT_HMAC_SECRET = 'test-secret-for-testing';
});

// ---------------------------------------------------------------------------
// getRedisPermissionSnapshot — Cache Miss
// ---------------------------------------------------------------------------
describe('getRedisPermissionSnapshot — Miss', () => {
  it('gibt miss zurück wenn kein Redis-Eintrag', async () => {
    mockRedis.get.mockResolvedValueOnce(null);

    const result = await getRedisPermissionSnapshot(baseKey);

    expect(result.hit).toBe(false);
    if (!result.hit) {
      expect(result.reason).toBe('miss');
    }
    expect(mockRedis.get).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getRedisPermissionSnapshot — Cache Hit
// ---------------------------------------------------------------------------
describe('getRedisPermissionSnapshot — Hit', () => {
  it('gibt Permissions zurück wenn HMAC korrekt', async () => {
    const permissions = [{ resource: 'posts', action: 'write', effect: 'allow' as const }];
    const stored = await makeValidStoredSnapshot(permissions);

    mockRedis.get.mockResolvedValueOnce(stored);

    const result = await getRedisPermissionSnapshot(baseKey);

    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.permissions).toEqual(permissions);
      expect(result.version).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// getRedisPermissionSnapshot — Integrity Error
// ---------------------------------------------------------------------------
describe('getRedisPermissionSnapshot — Integrity Error', () => {
  it('gibt integrity_error zurück wenn HMAC falsch ist', async () => {
    const tampered = JSON.stringify({
      permissions: [],
      version: 'abc123',
      schema_version: 1,
      signed_at: new Date().toISOString(),
      hmac: 'wrong-hmac-value',
    });

    mockRedis.get.mockResolvedValueOnce(tampered);
    mockRedis.del.mockResolvedValueOnce(1);

    const result = await getRedisPermissionSnapshot(baseKey);

    expect(result.hit).toBe(false);
    if (!result.hit) {
      expect(result.reason).toBe('integrity_error');
    }
    // Key sollte gelöscht worden sein
    expect(mockRedis.del).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getRedisPermissionSnapshot — Redis Unavailable
// ---------------------------------------------------------------------------
describe('getRedisPermissionSnapshot — Redis Unavailable', () => {
  it('gibt redis_unavailable zurück wenn Redis wirft', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await getRedisPermissionSnapshot(baseKey);

    expect(result.hit).toBe(false);
    if (!result.hit) {
      expect(result.reason).toBe('redis_unavailable');
    }
  });
});

// ---------------------------------------------------------------------------
// setRedisPermissionSnapshot
// ---------------------------------------------------------------------------
describe('setRedisPermissionSnapshot', () => {
  it('speichert mit HMAC und TTL 900', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    const permissions = [{ resource: 'r', action: 'a', effect: 'allow' as const }];

    const result = await setRedisPermissionSnapshot(baseKey, permissions);

    expect(result).toMatchObject({ ok: true });
    expect(mockRedis.setex).toHaveBeenCalledOnce();
    const [, ttl, raw] = mockRedis.setex.mock.calls[0]!;
    expect(ttl).toBe(900);

    const stored = JSON.parse(raw as string);
    expect(stored.hmac).toBeTruthy();
    expect(stored.permissions).toEqual(permissions);
    expect(stored.version).toHaveLength(16);
    expect(stored.schema_version).toBe(1);
    expect(stored.signed_at).toBeTruthy();
  });

  it('speichert mit Key-Format perm:v1:{inst}:{user}:{orgHash}:{geoHash}', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    const result = await setRedisPermissionSnapshot(baseKey, []);

    expect(result).toMatchObject({ ok: true });
    const redisKey = mockRedis.setex.mock.calls[0]![0] as string;
    expect(redisKey).toMatch(/^perm:v1:inst-test:user-test:/);
  });

  it('liefert redis_unavailable bei Redis-Fehler', async () => {
    mockRedis.setex.mockRejectedValueOnce(new Error('Timeout'));
    await expect(setRedisPermissionSnapshot(baseKey, [])).resolves.toEqual({
      ok: false,
      reason: 'redis_unavailable',
    });
  });

  it('enthält orgHash wenn organizationId gesetzt', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    const result = await setRedisPermissionSnapshot({ ...baseKey, organizationId: 'org-xyz' }, []);
    expect(result).toMatchObject({ ok: true });
    const redisKey = mockRedis.setex.mock.calls[0]![0] as string;
    const parts = redisKey.split(':');
    // perm:v1:inst:user:orgHash:geoHash → 6 Teile
    expect(parts).toHaveLength(6);
    // orgHash darf nicht 'none' sein wenn organizationId gesetzt
    expect(parts[4]).not.toBe('none');
  });

  it('enthält geoHash wenn geoCtxHash gesetzt', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    const result = await setRedisPermissionSnapshot({ ...baseKey, geoCtxHash: 'geo-hash-1' }, []);
    expect(result).toMatchObject({ ok: true });
    const redisKey = mockRedis.setex.mock.calls[0]![0] as string;
    const parts = redisKey.split(':');
    expect(parts[5]).toBe('geo-hash-1');
  });
});

// ---------------------------------------------------------------------------
// invalidateRedisPermissionSnapshots
// ---------------------------------------------------------------------------
describe('invalidateRedisPermissionSnapshots', () => {
  it('löscht alle Keys einer Instanz (kein userId)', async () => {
    mockRedis.scan
      .mockResolvedValueOnce(['0', ['perm:v1:inst-1:user-a:x:y', 'perm:v1:inst-1:user-b:x:y']])
      .mockResolvedValueOnce(['0', []]); // zweiter Scan (Cursor zurück zu 0)
    mockRedis.del.mockResolvedValue(2);

    // Erster Scan gibt cursor '123', zweiter gibt '0'
    mockRedis.scan
      .mockReset()
      .mockResolvedValueOnce(['123', ['key1', 'key2']])
      .mockResolvedValueOnce(['0', []]);
    mockRedis.del.mockResolvedValue(2);

    const deleted = await invalidateRedisPermissionSnapshots('inst-1');
    expect(deleted).toBe(2);
    expect(mockRedis.scan).toHaveBeenCalledTimes(2);

    // Pattern muss Instanz aber kein userId enthalten
    const pattern = mockRedis.scan.mock.calls[0]![2];
    expect(pattern).toContain('inst-1');
    expect(pattern).not.toContain('user-');
  });

  it('löscht nur Keys eines bestimmten Users', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', ['key-for-user']]);
    mockRedis.del.mockResolvedValue(1);

    const deleted = await invalidateRedisPermissionSnapshots('inst-2', 'user-42');
    expect(deleted).toBe(1);

    const pattern = mockRedis.scan.mock.calls[0]![2];
    expect(pattern).toContain('inst-2');
    expect(pattern).toContain('user-42');
  });

  it('gibt 0 zurück wenn keine Keys gefunden', async () => {
    mockRedis.scan.mockResolvedValueOnce(['0', []]);

    const deleted = await invalidateRedisPermissionSnapshots('inst-empty');
    expect(deleted).toBe(0);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('gibt 0 zurück bei Redis-Fehler (kein throw)', async () => {
    mockRedis.scan.mockRejectedValueOnce(new Error('SCAN failed'));
    const deleted = await invalidateRedisPermissionSnapshots('inst-error');
    expect(deleted).toBe(0);
  });
});

// ============================================================================
// Non-Error-Throws — deckt String(error) Branches bei GET, SET, SCAN ab
// ============================================================================
describe('Redis Snapshot — Non-Error-Throws (String(error) Branch)', () => {
  it('getRedisPermissionSnapshot: redis_unavailable bei Non-Error-throw', async () => {
    mockRedis.get.mockRejectedValueOnce('plain-string-redis-error');
    const result = await getRedisPermissionSnapshot(baseKey);
    expect(result.hit).toBe(false);
    if (!result.hit) expect(result.reason).toBe('redis_unavailable');
  });

  it('setRedisPermissionSnapshot: kein Fehler nach aussen bei Non-Error-throw', async () => {
    mockRedis.setex.mockRejectedValueOnce('plain-string-setex-error');
    await expect(setRedisPermissionSnapshot(baseKey, [])).resolves.toEqual({
      ok: false,
      reason: 'redis_unavailable',
    });
  });

  it('invalidateRedisPermissionSnapshots: gibt 0 zurueck bei Non-Error-throw von scan', async () => {
    mockRedis.scan.mockRejectedValueOnce('string-scan-error');
    const result = await invalidateRedisPermissionSnapshots('inst-non-error');
    expect(result).toBe(0);
  });
});

// ============================================================================
// HMAC-Secret Env-Var Fallback — deckt ?? Default-Branch ab
// ============================================================================
describe('computeHmac — Env-Var Fallback', () => {
  it('verwendet Default-Secret wenn REDIS_SNAPSHOT_HMAC_SECRET nicht gesetzt', async () => {
    const savedSecret = process.env.REDIS_SNAPSHOT_HMAC_SECRET;
    delete process.env.REDIS_SNAPSHOT_HMAC_SECRET;

    // Miss-Pfad: Schlüssel nicht in Redis -> kein HMAC-Fehler durch fehlendes Secret
    mockRedis.get.mockResolvedValueOnce(null);
    const result = await getRedisPermissionSnapshot(baseKey);

    process.env.REDIS_SNAPSHOT_HMAC_SECRET = savedSecret;

    expect(result.hit).toBe(false);
    if (!result.hit) expect(result.reason).toBe('miss');
  });
});
