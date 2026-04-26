import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginState, Session, SessionControlState } from './types.js';

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
    redis: new FakeRedis(),
  };
});

vi.mock('./audit-events.js', () => ({
  emitAuthAuditEvent: mocks.emitAuthAuditEvent,
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
});
