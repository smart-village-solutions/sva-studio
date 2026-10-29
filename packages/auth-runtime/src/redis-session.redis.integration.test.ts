import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { closeRedis, getRedisClient } from './redis.js';
import {
  createSession,
  deleteSession,
  getSession,
  setSessionControlState,
  updateSession,
} from './redis-session.js';
import { SessionNotFoundError, SessionTokenConflictError } from './runtime-errors.js';
import type { Session } from './types.js';

const integration = describe.skipIf(process.env.RUN_REDIS_SESSION_INTEGRATION !== '1');

integration('Redis session compare-and-set integration', () => {
  const keyPrefix = `studio-session-cas:${process.pid}:${randomUUID()}:`;
  const sessionIds: string[] = [];
  const userIds = new Set<string>();

  const createSessionRecord = (id: string, overrides: Partial<Session> = {}): Session => ({
    id,
    userId: `user-${id}`,
    user: { id: `user-${id}`, roles: ['system_admin'] },
    auth: {
      kind: 'platform',
      issuer: 'https://issuer.example.test',
      clientId: 'studio',
      postLogoutRedirectUri: 'https://studio.example.test/logout',
    },
    activeOrganizationId: 'org-1',
    accessToken: 'access-old',
    refreshToken: 'refresh-old',
    idToken: 'id-old',
    createdAt: Date.now(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 120_000,
    sessionVersion: 1,
    ...overrides,
  });

  const createStoredSession = async (overrides: Partial<Session> = {}) => {
    const id = randomUUID();
    const session = createSessionRecord(id, overrides);
    sessionIds.push(id);
    userIds.add(session.userId);
    await createSession(id, session, 180);
    return { id, session };
  };

  beforeAll(async () => {
    vi.stubEnv('SVA_AUTH_REDIS_KEY_PREFIX', keyPrefix);
    vi.stubEnv('ENCRYPTION_KEY', 'integration-only-session-encryption-key');
    const redis = getRedisClient();
    await redis.ping();
  });

  afterAll(async () => {
    const redis = getRedisClient();
    await Promise.all(sessionIds.map((id) => deleteSession(id)));
    await Promise.all(
      [...userIds].map((userId) =>
        redis.del(`${keyPrefix}session_control:${userId}`, `${keyPrefix}user_sessions:${userId}`)
      )
    );
    await closeRedis();
    vi.unstubAllEnvs();
  });

  it('retains concurrent token and organization field changes on real Redis', async () => {
    const { id } = await createStoredSession();

    await Promise.all([
      updateSession(id, { accessToken: 'access-new' }),
      updateSession(id, { activeOrganizationId: 'org-2' }),
    ]);

    await expect(getSession(id)).resolves.toMatchObject({
      accessToken: 'access-new',
      activeOrganizationId: 'org-2',
    });
  });

  it('rejects a commit when the separate control marker changes during compare-and-set', async () => {
    const { id, session } = await createStoredSession();
    const redis = getRedisClient();
    const originalEval = redis.eval.bind(redis);
    let revokeDuringCommit = true;
    const evalSpy = vi.spyOn(redis, 'eval').mockImplementation(async (script, numberOfKeys, ...args) => {
      if (revokeDuringCommit && String(script).includes('update_session_compare_and_set')) {
        revokeDuringCommit = false;
        await setSessionControlState(session.userId, { minimumSessionVersion: 2 }, null);
      }
      return originalEval(script, numberOfKeys, ...args);
    });

    try {
      await expect(updateSession(id, { activeOrganizationId: 'org-2' })).rejects.toBeInstanceOf(
        SessionNotFoundError
      );
    } finally {
      evalSpy.mockRestore();
    }
    await expect(getSession(id)).resolves.toMatchObject({ activeOrganizationId: 'org-1' });
  });

  it('never recreates a session deleted while an update is waiting to commit', async () => {
    const { id } = await createStoredSession();
    const redis = getRedisClient();
    const originalEval = redis.eval.bind(redis);
    let logoutBeforeCommit = true;
    const evalSpy = vi.spyOn(redis, 'eval').mockImplementation(async (script, numberOfKeys, ...args) => {
      if (logoutBeforeCommit && String(script).includes('update_session_compare_and_set')) {
        logoutBeforeCommit = false;
        await deleteSession(id);
      }
      return originalEval(script, numberOfKeys, ...args);
    });

    try {
      await expect(updateSession(id, { activeOrganizationId: 'org-2' })).rejects.toBeInstanceOf(
        SessionNotFoundError
      );
    } finally {
      evalSpy.mockRestore();
    }
    await expect(getSession(id)).resolves.toBeUndefined();
  });

  it('rejects a stale token package after a newer refresh has committed', async () => {
    const { id, session } = await createStoredSession();
    await updateSession(id, { accessToken: 'access-new', refreshToken: 'refresh-new' });

    await expect(
      updateSession(
        id,
        { accessToken: 'access-stale', refreshToken: 'refresh-stale' },
        {
          expectedTokenSet: {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            idToken: session.idToken,
          },
        }
      )
    ).rejects.toBeInstanceOf(SessionTokenConflictError);
    await expect(getSession(id)).resolves.toMatchObject({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    });
  });
});
