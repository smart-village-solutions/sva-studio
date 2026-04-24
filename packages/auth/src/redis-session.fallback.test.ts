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

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    workspaceId: 'hb-meinquartier',
    requestId: 'req-fallback',
    traceId: 'trace-fallback',
  }),
}));

const originalEnv = { ...process.env };

describe('redis-session fail-fast behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    process.env = {
      ...originalEnv,
      SVA_RUNTIME_PROFILE: 'studio',
      SVA_AUTH_ALLOW_IN_MEMORY_SESSION_FALLBACK: 'true',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails fast when login state storage is unavailable', async () => {
    const { createLoginState, consumeLoginState } = await import('./redis-session.server.js');

    await expect(
      createLoginState('state-1', {
        codeVerifier: 'verifier',
        nonce: 'nonce',
        createdAt: Date.now(),
      })
    ).rejects.toMatchObject({ name: 'SessionStoreUnavailableError', operation: 'create_login_state' });
    await expect(consumeLoginState('state-1')).rejects.toMatchObject({
      name: 'SessionStoreUnavailableError',
      operation: 'consume_login_state',
    });
    expect(state.logger.error).toHaveBeenCalledWith(
      'Redis session store unavailable',
      expect.objectContaining({
        operation: 'create_login_state',
        mode: 'fail_fast',
      })
    );
  });

  it('fails fast when session storage is unavailable', async () => {
    const { createSession, getSession } = await import('./redis-session.server.js');

    await expect(
      createSession('session-1', {
        id: 'session-1',
        userId: 'user-1',
        user: expect.objectContaining({
          id: 'user-1',
          roles: ['system_admin'],
          instanceId: 'hb-meinquartier',
        }),
        createdAt: Date.now(),
      } as never)
    ).rejects.toMatchObject({ name: 'SessionStoreUnavailableError', operation: 'create_session' });

    await expect(getSession('session-1')).rejects.toMatchObject({
      name: 'SessionStoreUnavailableError',
      operation: 'get_session',
    });
  });

  it('fails fast for session metadata operations when redis is unavailable', async () => {
    const { listUserSessionIds, setSessionControlState, getSessionControlState, getSessionCount } = await import(
      './redis-session.server.js'
    );

    await expect(listUserSessionIds('user-42')).rejects.toMatchObject({
      name: 'SessionStoreUnavailableError',
      operation: 'list_user_sessions',
    });
    await expect(
      setSessionControlState('user-42', {
        forceReauthAt: Date.now(),
        mode: 'app_only',
      })
    ).rejects.toMatchObject({ name: 'SessionStoreUnavailableError', operation: 'set_session_control_state' });
    await expect(getSessionControlState('user-42')).rejects.toMatchObject({
      name: 'SessionStoreUnavailableError',
      operation: 'get_session_control_state',
    });
    await expect(getSessionCount()).rejects.toMatchObject({
      name: 'SessionStoreUnavailableError',
      operation: 'get_session_count',
    });
  });
});
