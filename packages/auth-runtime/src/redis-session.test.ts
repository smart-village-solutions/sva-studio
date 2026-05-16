import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginState, Session, SessionControlState } from './types.js';

const expectDefined = <T>(value: T | undefined): T => {
  expect(value).toBeDefined();
  return value as T;
};

const mocks = vi.hoisted(() => {
  class FakeRedis {
    readonly data = new Map<string, string>();
    readonly sets = new Map<string, Set<string>>();
    readonly expirations = new Map<string, number>();

    async get(key: string): Promise<string | null> {
      return this.data.get(key) ?? null;
    }

    async set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK'> {
      this.data.set(key, value);
      if (mode === 'EX' && ttl !== undefined) {
        this.expirations.set(key, ttl);
      }
      return 'OK';
    }

    async del(key: string): Promise<number> {
      const removedData = this.data.delete(key) ? 1 : 0;
      const removedSet = this.sets.delete(key) ? 1 : 0;
      this.expirations.delete(key);
      return removedData + removedSet;
    }

    async sadd(key: string, value: string): Promise<number> {
      const set = this.sets.get(key) ?? new Set<string>();
      const sizeBefore = set.size;
      set.add(value);
      this.sets.set(key, set);
      return set.size - sizeBefore;
    }

    async srem(key: string, value: string): Promise<number> {
      const set = this.sets.get(key);
      if (!set) {
        return 0;
      }
      const removed = set.delete(value) ? 1 : 0;
      if (set.size === 0) {
        this.sets.delete(key);
      }
      return removed;
    }

    async smembers(key: string): Promise<string[]> {
      return Array.from(this.sets.get(key) ?? []);
    }

    async expire(key: string, ttl: number): Promise<number> {
      this.expirations.set(key, ttl);
      return this.data.has(key) || this.sets.has(key) ? 1 : 0;
    }

    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      return [...this.data.keys()].filter((key) => key.startsWith(prefix));
    }

    reset(): void {
      this.data.clear();
      this.sets.clear();
      this.expirations.clear();
    }
  }

  return {
    emitAuthAuditEvent: vi.fn(async () => undefined),
    encryptToken: vi.fn((value: string, key: string) => `enc(${key}):${value}`),
    decryptToken: vi.fn((value: string, key: string) => {
      if (!value.startsWith(`enc(${key}):`)) {
        throw new Error('decrypt failed');
      }
      return value.slice(`enc(${key}):`.length);
    }),
    getAuthConfig: vi.fn(() => ({
      sessionRedisTtlBufferMs: 60_000,
      sessionTtlMs: 120_000,
    })),
    redis: new FakeRedis(),
  };
});

vi.mock('./audit-events.js', () => ({
  emitAuthAuditEvent: mocks.emitAuthAuditEvent,
}));

vi.mock('./config.js', () => ({
  getAuthConfig: mocks.getAuthConfig,
}));

vi.mock('./crypto.js', () => ({
  encryptToken: mocks.encryptToken,
  decryptToken: mocks.decryptToken,
}));

vi.mock('./redis.js', () => ({
  getRedisClient: () => mocks.redis,
}));

import {
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
  getAllSessionKeys,
  getSession,
  getSessionControlState,
  getSessionCount,
  listUserSessionIds,
  setSessionControlState,
  updateSession,
} from './redis-session.js';

const createTestSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-a',
  userId: 'user-a',
  user: {
    id: 'user-a',
    roles: ['admin'],
  },
  auth: {
    kind: 'platform',
    issuer: 'https://auth.example.test',
    clientId: 'studio',
    postLogoutRedirectUri: 'https://studio.example.test/logout',
  },
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  ...overrides,
});

const createLoginStateInput = (overrides: Partial<LoginState> = {}): LoginState => ({
  kind: 'platform',
  codeVerifier: 'verifier',
  nonce: 'nonce',
  createdAt: Date.now(),
  returnTo: '/admin',
  ...overrides,
});

describe('redis-backed auth runtime session store', () => {
  beforeEach(() => {
    mocks.redis.reset();
    mocks.emitAuthAuditEvent.mockClear();
    mocks.encryptToken.mockClear();
    mocks.decryptToken.mockClear();
    mocks.getAuthConfig.mockClear();
    vi.unstubAllEnvs();
  });

  it('creates, reads, updates, indexes and deletes sessions through Redis', async () => {
    await createSession('session-a', createTestSession(), 120);

    await expect(getSession('session-a')).resolves.toMatchObject({
      id: 'session-a',
      userId: 'user-a',
    });
    await expect(listUserSessionIds('user-a')).resolves.toEqual(['session-a']);
    await expect(getAllSessionKeys()).resolves.toEqual(['session-a']);
    await expect(getSessionCount()).resolves.toBe(1);

    await updateSession('session-a', {
      activeOrganizationId: 'org-a',
      accessToken: 'access-token',
    });

    await expect(getSession('session-a')).resolves.toMatchObject({
      activeOrganizationId: 'org-a',
      accessToken: 'access-token',
    });

    await deleteSession('session-a');

    await expect(getSession('session-a')).resolves.toBeUndefined();
    await expect(listUserSessionIds('user-a')).resolves.toEqual([]);
    await expect(getSessionCount()).resolves.toBe(0);
    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'session_deleted', actorUserId: 'user-a' })
    );
  });

  it('consumes login state once and tracks session control state', async () => {
    await createLoginState('login-state-a', createLoginStateInput());

    await expect(consumeLoginState('login-state-a')).resolves.toMatchObject({
      codeVerifier: 'verifier',
      returnTo: '/admin',
    });
    await expect(consumeLoginState('login-state-a')).resolves.toBeUndefined();

    const controlState: SessionControlState = {
      minimumSessionVersion: 3,
      forcedReauthAt: 123,
    };
    await setSessionControlState('user-a', controlState, 300);

    await expect(getSessionControlState('user-a')).resolves.toEqual(controlState);
  });

  it('returns undefined for expired sessions and rejects missing session updates', async () => {
    await createSession(
      'expired',
      createTestSession({
        id: 'expired',
        expiresAt: Date.now() - 1_000,
      })
    );

    await expect(getSession('expired')).resolves.toBeUndefined();
    await expect(updateSession('missing', { accessToken: 'none' })).rejects.toThrow(
      'Session not found: missing'
    );
  });

  it('uses worker and explicit redis key prefixes and applies configured ttl fallback values', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VITEST_WORKER_ID', '7');

    await createSession(
      'session-prefixed',
      createTestSession({
        id: 'session-prefixed',
        expiresAt: undefined,
      })
    );
    await createLoginState('login-prefixed', createLoginStateInput());

    const prefixedSessionKey = [...mocks.redis.data.keys()].find((key) => key.endsWith('session:session-prefixed'));
    const prefixedLoginKey = [...mocks.redis.data.keys()].find((key) => key.endsWith('login_state:login-prefixed'));
    expect(prefixedSessionKey).toBeDefined();
    expect(prefixedLoginKey).toBeDefined();
    expect(prefixedSessionKey?.includes('session:session-prefixed')).toBe(true);
    expect(mocks.redis.expirations.get(expectDefined(prefixedSessionKey))).toBe(180);

    vi.stubEnv('SVA_AUTH_REDIS_KEY_PREFIX', 'custom:');
    await createSession('session-custom', createTestSession({ id: 'session-custom' }), 42);
    expect([...mocks.redis.data.keys()]).toContain('custom:session:session-custom');
    expect(mocks.redis.expirations.get('custom:session:session-custom')).toBe(42);
  });

  it('encrypts and decrypts configured session tokens and falls back when config or decryption fails', async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'secret-key');
    await createSession(
      'session-encrypted',
      createTestSession({
        id: 'session-encrypted',
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id',
      }),
      60
    );

    const encryptedSessionKey = [...mocks.redis.data.keys()].find((key) => key.endsWith('session:session-encrypted'));
    const stored = encryptedSessionKey ? mocks.redis.data.get(encryptedSessionKey) : undefined;
    expect(stored).toContain('enc(secret-key):access');
    await expect(getSession('session-encrypted')).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
    });

    mocks.getAuthConfig.mockImplementationOnce(() => {
      throw new Error('missing config');
    });
    await createSession(
      'session-default-ttl',
      createTestSession({
        id: 'session-default-ttl',
        expiresAt: undefined,
      })
    );
    const defaultTtlKey = [...mocks.redis.data.keys()].find((key) => key.endsWith('session:session-default-ttl'));
    expect(defaultTtlKey).toBeDefined();
    expect(mocks.redis.expirations.get(expectDefined(defaultTtlKey))).toBe(605100);

    const badEncryptionKey = [...mocks.redis.data.keys()].find((key) => key.endsWith('session:session-encrypted'))
      ?.replace('session-encrypted', 'session-bad-encryption') ?? 'session:session-bad-encryption';
    mocks.redis.data.set(
      badEncryptionKey,
      JSON.stringify({
        ...createTestSession({ id: 'session-bad-encryption' }),
        accessToken: 'invalid-value',
      })
    );
    await expect(getSession('session-bad-encryption')).resolves.toMatchObject({
      accessToken: 'invalid-value',
    });
  });

  it('handles empty control state, cleanup helpers and redis failures as typed store errors', async () => {
    await expect(getSessionControlState('missing-user')).resolves.toBeUndefined();
    await expect(listUserSessionIds('missing-user')).resolves.toEqual([]);
    await expect(getAllSessionKeys()).resolves.toEqual([]);
    await expect(getSessionCount()).resolves.toBe(0);
    await expect(import('./redis-session.js').then((mod) => mod.clearExpiredSessions())).resolves.toBeUndefined();

    const originalGet = mocks.redis.get.bind(mocks.redis);
    mocks.redis.get = vi.fn(async () => {
      throw 'redis down';
    }) as typeof mocks.redis.get;
    await expect(getSession('broken')).rejects.toThrow('Session store unavailable during get_session');
    mocks.redis.get = originalGet;
  });
});
