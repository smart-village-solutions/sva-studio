import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  store: new Map<string, string>(),
  sets: new Map<string, Set<string>>(),
  emitAuthAuditEvent: vi.fn(async () => undefined),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: vi.fn() }),
      createHistogram: () => ({ record: vi.fn() }),
    }),
  },
}));

vi.mock('./audit-events.server.js', () => ({
  emitAuthAuditEvent: (...args: Parameters<typeof state.emitAuthAuditEvent>) => state.emitAuthAuditEvent(...args),
}));

vi.mock('./config.js', () => ({
  getAuthConfig: () => ({
    sessionRedisTtlBufferMs: 300_000,
    sessionTtlMs: 3_600_000,
  }),
}));

vi.mock('./crypto.server.js', () => ({
  encryptToken: (value: string) => `enc:${value}`,
  decryptToken: (value: string) => value.replace(/^enc:/, ''),
}));

vi.mock('./session.js', () => ({
  clearExpiredLoginStates: vi.fn(),
  clearExpiredSessions: vi.fn(),
  consumeLoginState: vi.fn(),
  createLoginState: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('./redis.server.js', () => ({
  getRedisClient: () => ({
    get: vi.fn(async (key: string) => state.store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      state.store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      keys.forEach((key) => {
        state.store.delete(key);
        state.sets.delete(key);
      });
      return keys.length;
    }),
    sadd: vi.fn(async (key: string, value: string) => {
      const current = state.sets.get(key) ?? new Set<string>();
      current.add(value);
      state.sets.set(key, current);
      return 1;
    }),
    srem: vi.fn(async (key: string, value: string) => {
      state.sets.get(key)?.delete(value);
      return 1;
    }),
    expire: vi.fn(async () => 1),
  }),
}));

import {
  consumeLoginState,
  createLoginState,
  createSession,
  deleteSession,
} from './redis-session.server.js';
import type { Session } from './types.js';

describe('redis-session audit events', () => {
  beforeEach(() => {
    state.store.clear();
    state.sets.clear();
    state.emitAuthAuditEvent.mockClear();
    vi.stubEnv('ENCRYPTION_KEY', '');
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-keycloak');
    vi.stubEnv('SVA_AUTH_REDIS_KEY_PREFIX', '');
  });

  it('emits a session_created audit event with actor context', async () => {
    const session: Session = {
      id: 'session-1',
      userId: 'user-1',
      auth: { kind: 'instance', instanceId: 'de-musterhausen' },
      user: { id: 'user-1', instanceId: 'de-musterhausen', roles: ['editor'] },
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };

    await createSession('session-1', session);

    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_created',
        actorUserId: 'user-1',
        workspaceId: 'de-musterhausen',
        outcome: 'success',
      })
    );
  });

  it('emits a session_deleted audit event when an existing session is removed', async () => {
    const session: Session = {
      id: 'session-2',
      userId: 'user-2',
      auth: { kind: 'instance', instanceId: 'de-musterhausen' },
      user: { id: 'user-2', instanceId: 'de-musterhausen', roles: ['editor'] },
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };

    state.store.set('session:session-2', JSON.stringify(session));

    await deleteSession('session-2');

    expect(state.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_deleted',
        actorUserId: 'user-2',
        workspaceId: 'de-musterhausen',
        outcome: 'success',
      })
    );
  });

  it('emits login-state audit events for creation and consumption', async () => {
    await createLoginState('state-1', {
      kind: 'instance',
      instanceId: 'de-musterhausen',
      codeVerifier: 'verifier',
      nonce: 'nonce',
      createdAt: Date.now(),
      returnTo: '/',
    });

    expect(state.emitAuthAuditEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'login_state_created',
        outcome: 'success',
        workspaceId: 'de-musterhausen',
      })
    );

    await consumeLoginState('state-1');

    expect(state.emitAuthAuditEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'login_state_consumed',
        outcome: 'success',
      })
    );
  });
});
