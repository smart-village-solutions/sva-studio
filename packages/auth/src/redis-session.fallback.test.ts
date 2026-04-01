import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./redis.server.js', () => ({
  getRedisClient: () => ({
    set: vi.fn(async () => {
      throw new Error('redis down');
    }),
    get: vi.fn(async () => {
      throw new Error('redis down');
    }),
    del: vi.fn(async () => {
      throw new Error('redis down');
    }),
    ttl: vi.fn(async () => {
      throw new Error('redis down');
    }),
    keys: vi.fn(async () => {
      throw new Error('redis down');
    }),
  }),
}));

vi.mock('./crypto.server.js', () => ({
  encryptToken: (value: string) => value,
  decryptToken: (value: string) => value,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    workspaceId: 'hb-meinquartier',
    requestId: 'req-fallback',
    traceId: 'trace-fallback',
  }),
}));

const originalEnv = { ...process.env };

describe('redis-session in-memory fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    process.env = {
      ...originalEnv,
      SVA_RUNTIME_PROFILE: 'acceptance-hb',
      SVA_AUTH_ALLOW_IN_MEMORY_SESSION_FALLBACK: 'true',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('stores and consumes login state in memory when redis is unavailable', async () => {
    const { createLoginState, consumeLoginState } = await import('./redis-session.server.js');

    await createLoginState('state-1', {
      codeVerifier: 'verifier',
      nonce: 'nonce',
      createdAt: Date.now(),
    });

    await expect(consumeLoginState('state-1')).resolves.toEqual({
      codeVerifier: 'verifier',
      nonce: 'nonce',
      createdAt: expect.any(Number),
    });
    await expect(consumeLoginState('state-1')).resolves.toBeUndefined();
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Redis session store unavailable, using in-memory fallback',
      expect.objectContaining({
        operation: 'create_login_state',
        runtime_profile: 'acceptance-hb',
      })
    );
  });

  it('stores and reads sessions in memory when redis is unavailable', async () => {
    const { createSession, getSession } = await import('./redis-session.server.js');

    await createSession('session-1', {
      id: 'session-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        roles: ['system_admin'],
        instanceId: 'hb-meinquartier',
      },
      createdAt: Date.now(),
    });

    await expect(getSession('session-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'session-1',
        userId: 'user-1',
        user: expect.objectContaining({
          id: 'user-1',
          roles: ['system_admin'],
          instanceId: 'hb-meinquartier',
        }),
      })
    );
  });

  it('tracks fallback user sessions and session control state in memory', async () => {
    const {
      createSession,
      deleteSession,
      listUserSessionIds,
      setSessionControlState,
      getSessionControlState,
    } = await import('./redis-session.server.js');

    await createSession('session-a', {
      id: 'session-a',
      userId: 'user-42',
      createdAt: Date.now(),
    });
    await createSession('session-b', {
      id: 'session-b',
      userId: 'user-42',
      createdAt: Date.now(),
    });

    expect(await listUserSessionIds('user-42')).toEqual(['session-a', 'session-b']);

    await deleteSession('session-a');
    expect(await listUserSessionIds('user-42')).toEqual(['session-b']);

    await setSessionControlState('user-42', {
      forceReauthAt: Date.now(),
      mode: 'app_only',
    });
    await expect(getSessionControlState('user-42')).resolves.toEqual({
      forceReauthAt: expect.any(Number),
      mode: 'app_only',
    });
  });
});
