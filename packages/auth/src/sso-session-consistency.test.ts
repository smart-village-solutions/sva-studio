import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getSessionUser } from './auth.server';
import { closeRedis } from './redis.server';
import { ensureRedisAvailabilityChecked } from './redis-test-guard.test-utils.js';
import { createSession, deleteSession } from './redis-session.server';
import type { Session } from './types';

(await ensureRedisAvailabilityChecked() ? describe : describe.skip)('SSO Session Consistency (Multi-Tab)', () => {
  const sessionId = 'sso-multi-tab-session';
  const envBackup = { ...process.env };

  beforeAll(() => {
    process.env.SVA_AUTH_REDIS_KEY_PREFIX = 'vitest:sso-session-consistency-suite:';
    process.env.SVA_AUTH_ISSUER ??= 'https://issuer.example';
    process.env.SVA_AUTH_CLIENT_ID ??= 'sva-client';
    process.env.SVA_AUTH_CLIENT_SECRET ??= 'test-secret';
    process.env.SVA_AUTH_REDIRECT_URI ??= 'http://localhost:3000/auth/callback';
    process.env.SVA_AUTH_POST_LOGOUT_REDIRECT_URI ??= 'http://localhost:3000';
  });

  beforeEach(async () => {
    await deleteSession(sessionId);
  });

  afterAll(async () => {
    await closeRedis();
    process.env = envBackup;
  });

  it('keeps session consistent across two tabs and invalidates both after logout', async () => {
    const now = Date.now();
    const session: Session = {
      id: sessionId,
      userId: 'user-sso-1',
      user: {
        id: 'user-sso-1',
        name: 'SSO User',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      createdAt: now,
      expiresAt: now + 5 * 60_000,
    };

    await createSession(sessionId, session);

    // Tab A and Tab B share the same authenticated session.
    const tabAUser = await getSessionUser(sessionId);
    const tabBUser = await getSessionUser(sessionId);
    expect(tabAUser?.id).toBe('user-sso-1');
    expect(tabBUser?.id).toBe('user-sso-1');

    // Logout in one tab revokes the session for both tabs.
    await deleteSession(sessionId);
    const tabAAfterLogout = await getSessionUser(sessionId);
    const tabBAfterLogout = await getSessionUser(sessionId);
    expect(tabAAfterLogout).toBeNull();
    expect(tabBAfterLogout).toBeNull();
  });
});
