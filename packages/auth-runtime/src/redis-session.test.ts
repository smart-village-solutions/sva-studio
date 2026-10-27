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

    async getdel(key: string): Promise<string | null> {
      const value = this.data.get(key) ?? null;
      this.data.delete(key);
      this.expirations.delete(key);
      return value;
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

    async eval(script: string, numberOfKeys: number, ...args: string[]): Promise<number> {
      const keys = args.slice(0, numberOfKeys);
      const values = args.slice(numberOfKeys);
      if (script.includes('update_session_compare_and_set')) {
        const [sessionKey, controlKey, userSessionsKey] = keys;
        const [expectedSession, expectedControl, replacement, ttl, sessionId] = values;
        const current = this.data.get(sessionKey);
        if (!current) return -1;
        if (current !== expectedSession || (this.data.get(controlKey) ?? '') !== expectedControl) {
          return 0;
        }
        const session = JSON.parse(current) as Session;
        if (session.expiresAt && session.expiresAt < Date.now()) return -1;
        this.data.set(sessionKey, replacement);
        const resolvedTtl = Number(ttl);
        this.expirations.set(sessionKey, resolvedTtl);
        const sessions = this.sets.get(userSessionsKey) ?? new Set<string>();
        sessions.add(sessionId);
        this.sets.set(userSessionsKey, sessions);
        this.expirations.set(userSessionsKey, resolvedTtl);
        return 1;
      }
      if (script.includes('delete_session_if_unchanged')) {
        const [sessionKey, userSessionsKey] = keys;
        const [expectedSession, userId] = values;
        if (this.data.get(sessionKey) !== expectedSession) return 0;
        this.data.delete(sessionKey);
        this.expirations.delete(sessionKey);
        this.sets.get(userSessionsKey)?.delete(userId);
        return 1;
      }
      throw new Error('Unexpected Redis script in test fake');
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
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
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

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
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
    mocks.logger.debug.mockClear();
    mocks.logger.error.mockClear();
    mocks.logger.info.mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv('ENCRYPTION_KEY', 'secret-key');
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

  it.each([1, 2])(
    'preserves independent token and organization updates for concurrent commit order %i',
    async (delayedAttempt) => {
    await createSession(
      'session-concurrent',
      createTestSession({ id: 'session-concurrent', activeOrganizationId: 'org-1' })
    );

      const originalEval = mocks.redis.eval.bind(mocks.redis);
      let attempt = 0;
      let releaseDelayedAttempt: () => void = () => undefined;
      let resolveEarlierCommit: () => void = () => undefined;
      const delayedGate = new Promise<void>((resolve) => {
        releaseDelayedAttempt = resolve;
      });
      const earlierCommit = new Promise<void>((resolve) => {
        resolveEarlierCommit = resolve;
      });
      mocks.redis.eval = vi.fn(async (script: string, numberOfKeys: number, ...args: string[]) => {
        attempt += 1;
        const currentAttempt = attempt;
        if (currentAttempt === delayedAttempt) await delayedGate;
        const result = await originalEval(script, numberOfKeys, ...args);
        if (currentAttempt !== delayedAttempt && result === 1) resolveEarlierCommit();
        return result;
      });

      const tokenUpdate = updateSession('session-concurrent', { accessToken: 'new-access' });
      const organizationUpdate = updateSession('session-concurrent', {
        activeOrganizationId: 'org-2',
      });
      await earlierCommit;
      releaseDelayedAttempt();
      await Promise.all([tokenUpdate, organizationUpdate]);
      mocks.redis.eval = originalEval;

      await expect(getSession('session-concurrent')).resolves.toMatchObject({
        accessToken: 'new-access',
        activeOrganizationId: 'org-2',
      });
    }
  );

  it('does not commit after the separate session-control marker changes to revoke the session', async () => {
    await createSession('session-revoked-during-update', createTestSession());
    const originalEval = mocks.redis.eval.bind(mocks.redis);
    let changeMarker = true;
    mocks.redis.eval = vi.fn(async (script: string, numberOfKeys: number, ...args: string[]) => {
      if (changeMarker && script.includes('update_session_compare_and_set')) {
        changeMarker = false;
        await setSessionControlState('user-a', { minimumSessionVersion: 2 }, null);
      }
      return originalEval(script, numberOfKeys, ...args);
    });

    await expect(
      updateSession('session-revoked-during-update', { activeOrganizationId: 'org-2' })
    ).rejects.toThrow('Session no longer exists or has expired');
    mocks.redis.eval = originalEval;
    await expect(
      getSession('session-revoked-during-update').then((session) => session?.activeOrganizationId)
    ).resolves.toBeUndefined();
  });

  it('rejects a stale token commit after another refresh replaced the token set', async () => {
    await createSession(
      'session-stale-token',
      createTestSession({ id: 'session-stale-token', refreshToken: 'refresh-old' })
    );
    const { SessionTokenConflictError } = await import('./runtime-errors.js');

    await updateSession('session-stale-token', {
      refreshToken: 'refresh-new',
      accessToken: 'access-new',
    });
    await expect(
      updateSession(
        'session-stale-token',
        { refreshToken: 'refresh-stale', accessToken: 'access-stale' },
        { expectedTokenSet: { refreshToken: 'refresh-old' } }
      )
    ).rejects.toBeInstanceOf(SessionTokenConflictError);
    await expect(getSession('session-stale-token')).resolves.toMatchObject({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    });
  });

  it('stops after the bounded compare-and-set conflict retries', async () => {
    await createSession(
      'session-conflict-limit',
      createTestSession({ id: 'session-conflict-limit', activeOrganizationId: 'org-1' })
    );
    const originalEval = mocks.redis.eval.bind(mocks.redis);
    let compareAttempts = 0;
    mocks.redis.eval = vi.fn(async (script: string, numberOfKeys: number, ...args: string[]) => {
      if (script.includes('update_session_compare_and_set')) {
        compareAttempts += 1;
        return 0;
      }
      return originalEval(script, numberOfKeys, ...args);
    });

    try {
      const { SessionStoreConflictError } = await import('./runtime-errors.js');
      await expect(updateSession('session-conflict-limit', { activeOrganizationId: 'org-2' }))
        .rejects.toBeInstanceOf(SessionStoreConflictError);
    } finally {
      mocks.redis.eval = originalEval;
    }

    expect(compareAttempts).toBe(5);
    await expect(getSession('session-conflict-limit')).resolves.toMatchObject({
      activeOrganizationId: 'org-1',
    });
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

  it('allows only one concurrent consumer to claim a login state atomically', async () => {
    await createLoginState('concurrent-state', createLoginStateInput({
      kind: 'instance',
      instanceId: 'tenant-a',
    }));

    const results = await Promise.all([
      consumeLoginState('concurrent-state'),
      consumeLoginState('concurrent-state'),
    ]);

    expect(results.filter((result) => result !== undefined)).toEqual([
      expect.objectContaining({ kind: 'instance', instanceId: 'tenant-a' }),
    ]);
    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledTimes(2);
    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login_state_consumed',
        scope: { kind: 'instance', instanceId: 'tenant-a' },
        workspaceId: 'tenant-a',
      })
    );
  });

  it('fails closed and permits a retry when the atomic consume command fails', async () => {
    await createLoginState('retry-state', createLoginStateInput());
    const originalGetdel = mocks.redis.getdel.bind(mocks.redis);
    mocks.redis.getdel = vi.fn().mockRejectedValueOnce(new Error('redis unavailable'))
      .mockImplementation(originalGetdel) as typeof mocks.redis.getdel;

    await expect(consumeLoginState('retry-state')).rejects.toThrow(
      'Session store unavailable during consume_login_state'
    );
    await expect(consumeLoginState('retry-state')).resolves.toMatchObject({
      codeVerifier: 'verifier',
    });
    await expect(consumeLoginState('retry-state')).resolves.toBeUndefined();
    mocks.redis.getdel = originalGetdel;
  });

  it('persists session control state without redis expiry when no ttl is supplied', async () => {
    const controlState: SessionControlState = {
      minimumSessionVersion: 7,
      forcedReauthAt: 456,
    };

    await setSessionControlState('user-persistent', controlState, null);

    await expect(getSessionControlState('user-persistent')).resolves.toEqual(controlState);
    const controlKey = [...mocks.redis.data.keys()].find((key) =>
      key.endsWith('session_control:user-persistent')
    );
    expect(controlKey).toBeDefined();
    expect(controlKey ? mocks.redis.expirations.has(controlKey) : false).toBe(false);
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
      'Session no longer exists or has expired'
    );
  });

  it('does not restore a session that expires before an update', async () => {
    const { SessionNotFoundError } = await import('./runtime-errors.js');
    vi.useFakeTimers();
    try {
      const expiresAt = Date.now() + 100;
      await createSession('refresh-expiry', createTestSession({ expiresAt }));
      expect(await getSession('refresh-expiry')).toBeDefined();
      vi.setSystemTime(expiresAt + 1);
      await expect(
        updateSession('refresh-expiry', { expiresAt: expiresAt + 60_000 })
      ).rejects.toBeInstanceOf(SessionNotFoundError);
      expect(await getSession('refresh-expiry')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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

    const prefixedSessionKey = [...mocks.redis.data.keys()].find((key) =>
      key.endsWith('session:session-prefixed')
    );
    const prefixedLoginKey = [...mocks.redis.data.keys()].find((key) =>
      key.endsWith('login_state:login-prefixed')
    );
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

    const encryptedSessionKey = [...mocks.redis.data.keys()].find((key) =>
      key.endsWith('session:session-encrypted')
    );
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
    const defaultTtlKey = [...mocks.redis.data.keys()].find((key) =>
      key.endsWith('session:session-default-ttl')
    );
    expect(defaultTtlKey).toBeDefined();
    expect(mocks.redis.expirations.get(expectDefined(defaultTtlKey))).toBe(605100);

    const badEncryptionKey =
      [...mocks.redis.data.keys()]
        .find((key) => key.endsWith('session:session-encrypted'))
        ?.replace('session-encrypted', 'session-bad-encryption') ??
      'session:session-bad-encryption';
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

  it.each(['local-keycloak', 'local-builder', 'studio'])(
    'rejects session token reads and writes without ENCRYPTION_KEY in %s',
    async (profile) => {
      vi.stubEnv('SVA_RUNTIME_PROFILE', profile);
      const session = createTestSession({
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id',
      });
      await createSession('session-encrypted', session, 60);
      const storedBefore = [...mocks.redis.data.values()][0];

      vi.stubEnv('ENCRYPTION_KEY', '');
      await expect(createSession('session-plaintext', session, 60)).rejects.toThrow(
        'ENCRYPTION_KEY'
      );
      await expect(getSession('session-encrypted')).rejects.toThrow('ENCRYPTION_KEY');
      await expect(getSession('session-encrypted', { decryptTokens: false })).rejects.toThrow(
        'ENCRYPTION_KEY'
      );
      await expect(
        updateSession('session-encrypted', { accessToken: 'new-access' })
      ).rejects.toThrow('ENCRYPTION_KEY');
      expect(mocks.redis.data.size).toBe(1);
      expect([...mocks.redis.data.values()][0]).toBe(storedBefore);
      await expect(deleteSession('session-encrypted')).resolves.toBeUndefined();
      await expect(listUserSessionIds('user-a')).resolves.toEqual([]);
      expect(mocks.redis.data.size).toBe(0);
    }
  );

  it('can read session metadata without decrypting stored tokens', async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'secret-key');
    await createSession(
      'session-fast-read',
      createTestSession({
        id: 'session-fast-read',
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id',
      }),
      60
    );

    await expect(getSession('session-fast-read', { decryptTokens: false })).resolves.toMatchObject({
      id: 'session-fast-read',
      accessToken: 'enc(secret-key):access',
      refreshToken: 'enc(secret-key):refresh',
      idToken: 'enc(secret-key):id',
      userId: 'user-a',
    });
    expect(mocks.decryptToken).not.toHaveBeenCalled();
  });

  it('logs getSession timing diagnostics when authorize timing debug is enabled', async () => {
    vi.stubEnv('IAM_DEBUG_AUTHORIZE_TIMINGS', 'true');
    vi.stubEnv('ENCRYPTION_KEY', 'secret-key');
    await createSession(
      'timed-session',
      createTestSession({
        id: 'timed-session',
        accessToken: 'access',
        refreshToken: 'refresh',
        idToken: 'id',
      }),
      60
    );

    await expect(getSession('timed-session')).resolves.toMatchObject({
      id: 'timed-session',
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
    });

    expect(mocks.logger.info).toHaveBeenCalledWith(
      'Redis session get timing diagnostics',
      expect.objectContaining({
        operation: 'redis_session_get_timing',
        found: true,
        redis_get_ms: expect.any(Number),
        json_parse_ms: expect.any(Number),
        decrypt_ms: expect.any(Number),
        expiry_check_ms: expect.any(Number),
        total_ms: expect.any(Number),
        has_access_token: true,
        has_refresh_token: true,
        has_id_token: true,
        user_id: 'user-a',
      })
    );
  });

  it('handles empty control state, cleanup helpers and redis failures as typed store errors', async () => {
    await expect(getSessionControlState('missing-user')).resolves.toBeUndefined();
    await expect(listUserSessionIds('missing-user')).resolves.toEqual([]);
    await expect(getAllSessionKeys()).resolves.toEqual([]);
    await expect(getSessionCount()).resolves.toBe(0);
    await expect(
      import('./redis-session.js').then((mod) => mod.clearExpiredSessions())
    ).resolves.toBeUndefined();

    const originalGet = mocks.redis.get.bind(mocks.redis);
    mocks.redis.get = vi.fn(async () => {
      throw 'redis down';
    }) as typeof mocks.redis.get;
    await expect(getSession('broken')).rejects.toThrow(
      'Session store unavailable during get_session'
    );
    mocks.redis.get = originalGet;
  });
});
