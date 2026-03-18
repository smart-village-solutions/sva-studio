import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vor Imports)
// ---------------------------------------------------------------------------
vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableCounter: () => ({ addCallback: vi.fn() }),
      createObservableUpDownCounter: () => ({ addCallback: vi.fn() }),
    }),
  },
}));

vi.mock('../iam-authorization.cache', () => {
  class PermissionSnapshotCache {
    get = vi.fn();
    set = vi.fn();
    invalidate = vi.fn();
  }
  return { PermissionSnapshotCache, parseInvalidationEvent: vi.fn() };
});

vi.mock('../shared/db-helpers', () => ({
  createPoolResolver: vi.fn(() => vi.fn()),
  withInstanceDb: vi.fn(),
  jsonResponse: vi.fn(),
}));

vi.mock('../shared/input-readers', () => ({ isUuid: vi.fn(() => true), readString: vi.fn() }));
vi.mock('../shared/log-context', () => ({
  buildLogContext: vi.fn((wsId?: string) => ({ workspace_id: wsId ?? 'unknown' })),
}));
vi.mock('../shared/schemas', () => ({ authorizeRequestSchema: { safeParse: vi.fn() } }));

// ---------------------------------------------------------------------------
// State für shared-Mocks
// ---------------------------------------------------------------------------
const cacheGetResult = vi.hoisted(() => ({
  value: { status: 'miss' as 'miss' | 'stale' | 'hit', snapshot: null as null | { permissions: unknown[] }, ttlRemainingSeconds: 0, ageSeconds: 0 }
}));

const dbResult = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as unknown,
}));

const redisState = vi.hoisted(() => ({
  lookup: { hit: false as false, reason: 'miss' as 'miss' | 'integrity_error' | 'redis_unavailable' } as
    | { hit: true; permissions: unknown[]; version: string }
    | { hit: false; reason: 'miss' | 'integrity_error' | 'redis_unavailable' },
  write: { ok: true, version: 'version-1' } as
    | { ok: true; version: string }
    | { ok: false; reason: 'redis_unavailable' },
}));

vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shared')>();
  return {
    ...actual,
    permissionSnapshotCache: {
      get: vi.fn(() => cacheGetResult.value),
      set: vi.fn(),
      invalidate: vi.fn(),
      size: vi.fn(() => 0),
    },
    ensureInvalidationListener: vi.fn().mockResolvedValue(undefined),
    withInstanceScopedDb: vi.fn(async (_id: string, fn: (c: unknown) => Promise<unknown>) => {
      if (dbResult.error !== null) throw dbResult.error;
      const client = { query: vi.fn().mockResolvedValue({ rows: dbResult.rows }) };
      return fn(client);
    }),
    iamCacheLookupCounter: { add: vi.fn() },
    cacheLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cacheMetricsState: { lookups: 0, staleLookups: 0 },
    buildRequestContext: vi.fn(() => ({})),
  };
});

vi.mock('./redis-permission-snapshot.server', () => ({
  getRedisPermissionSnapshot: vi.fn(() => Promise.resolve(redisState.lookup)),
  setRedisPermissionSnapshot: vi.fn(() => Promise.resolve(redisState.write)),
}));

// ---------------------------------------------------------------------------
// Imports (nach Mocks)
// ---------------------------------------------------------------------------
import { resolveEffectivePermissions } from './permission-store';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  cacheGetResult.value = { status: 'miss', snapshot: null, ttlRemainingSeconds: 0, ageSeconds: 0 };
  dbResult.rows = [];
  dbResult.error = null;
  redisState.lookup = { hit: false, reason: 'miss' };
  redisState.write = { ok: true, version: 'version-1' };
});

const baseInput = {
  instanceId: 'inst-test',
  keycloakSubject: 'user-test',
};

// ============================================================================
// Cache-Miss — erfolgreicher DB-Load (cacheStatus: 'miss')
// ============================================================================
describe('resolveEffectivePermissions — Cache-Miss', () => {
  it("liefert 'hit' wenn Redis einen vorhandenen Snapshot findet", async () => {
    redisState.lookup = {
      hit: true,
      permissions: [{ action: 'content.read', resourceType: 'content', sourceRoleIds: ['role-1'] }],
      version: 'redis-version',
    };
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheStatus).toBe('hit');
    }
  });

  it("gibt cacheStatus 'miss' zurück wenn cache-Status 'miss' und DB erfolgreich", async () => {
    cacheGetResult.value = { status: 'miss', snapshot: null, ttlRemainingSeconds: 0, ageSeconds: 0 };
    dbResult.rows = [];
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheStatus).toBe('miss');
    }
  });

  it('gibt database_unavailable zurück wenn cache miss und DB wirft Error', async () => {
    cacheGetResult.value = { status: 'miss', snapshot: null, ttlRemainingSeconds: 0, ageSeconds: 0 };
    dbResult.error = new Error('DB connection lost');
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('database_unavailable');
    }
  });

  it('gibt database_unavailable zurück wenn cache miss und DB wirft Non-Error (String)', async () => {
    cacheGetResult.value = { status: 'miss', snapshot: null, ttlRemainingSeconds: 0, ageSeconds: 0 };
    dbResult.error = 'plain-string-error'; // Deckt String(error) Branch ab
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('database_unavailable');
    }
  });

  it('gibt database_unavailable zurück wenn Redis-Lookup fehlschlägt', async () => {
    redisState.lookup = { hit: false, reason: 'redis_unavailable' };
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('database_unavailable');
    }
  });

  it('gibt database_unavailable zurück wenn Redis-Write nach Recompute fehlschlägt', async () => {
    redisState.write = { ok: false, reason: 'redis_unavailable' };
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('database_unavailable');
    }
  });
});

// ============================================================================
// Cache-Stale — Recompute
// ============================================================================
describe('resolveEffectivePermissions — Cache-Stale', () => {
  it("gibt cacheStatus 'recompute' zurück wenn cache-Status 'stale' und DB erfolgreich", async () => {
    cacheGetResult.value = { status: 'stale', snapshot: null, ttlRemainingSeconds: 0, ageSeconds: 400 };
    dbResult.rows = [];
    const result = await resolveEffectivePermissions(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheStatus).toBe('recompute');
    }
  });
});
