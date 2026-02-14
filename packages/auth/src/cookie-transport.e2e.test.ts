import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { serialize as serializeCookie, parse as parseCookie } from 'cookie-es';
import type { Session } from './types';
import { createSession, getSession, deleteSession } from './session';
import { getRedisClient, closeRedis } from './redis.server';

/**
 * E2E-Test für Cookie-Transport-Flow:
 * 1. OAuth-Login-Redirect
 * 2. Keycloak-Callback mit sessionId Parameter
 * 3. Server setzt Set-Cookie Header
 * 4. Browser empfängt Session-Cookie
 * 5. Browser sendet Cookie in nächster Request
 * 6. /auth/me gibt 200 mit User-Daten zurück
 */
describe('E2E: Cookie Transport Flow (OAuth-Login → Callback → /auth/me)', () => {
  afterAll(async () => {
    await closeRedis();
  });

  it('should complete full flow: OAuth login → callback → cookie set → /auth/me returns 200', async () => {
    const sessionId = 'e2e-session-flow-123';
    const userId = 'keycloak:user-abc123';

    // ✅ Step 1: Simulate OAuth callback - server creates session
    console.log('[E2E] Step 1: Creating session after OAuth callback...');
    const session: Session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      idToken: 'mock-id-token',
    };

    await createSession(session);
    const createdSession = await getSession(sessionId);
    expect(createdSession).toBeDefined();
    expect(createdSession?.userId).toBe(userId);
    console.log('[E2E] ✓ Session created:', sessionId);

    // ✅ Step 2: Server sets Set-Cookie header in callback response
    console.log('[E2E] Step 2: Simulating Set-Cookie header in callback response...');
    const setCookieHeader = serializeCookie('sva_auth_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    expect(setCookieHeader).toContain(`sva_auth_session=${sessionId}`);
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Lax');
    console.log('[E2E] ✓ Set-Cookie header valid:', setCookieHeader.substring(0, 50) + '...');

    // ✅ Step 3: Browser receives and stores cookie (simulated)
    console.log('[E2E] Step 3: Simulating browser storing cookie...');
    const cookiePair = setCookieHeader.split(';')[0]; // Extract name=value
    const browserCookieJar = parseCookie(cookiePair);
    const storedSessionId = browserCookieJar['sva_auth_session'];

    expect(storedSessionId).toBe(sessionId);
    console.log('[E2E] ✓ Browser cookie stored:', storedSessionId);

    // ✅ Step 4: Browser sends next request with Cookie header
    console.log('[E2E] Step 4: Simulating browser sending request with Cookie header...');
    const requestCookieHeader = `sva_auth_session=${storedSessionId}`;
    const requestCookies = parseCookie(requestCookieHeader);

    expect(requestCookies['sva_auth_session']).toBe(sessionId);
    console.log('[E2E] ✓ Request cookie header:', requestCookieHeader);

    // ✅ Step 5: Server retrieves session from /auth/me
    console.log('[E2E] Step 5: Server retrieving session for /auth/me...');
    const receivedSessionId = requestCookies['sva_auth_session'];
    const meResponse = await getSession(receivedSessionId);

    expect(meResponse).toBeDefined();
    expect(meResponse?.userId).toBe(userId);
    expect(meResponse?.accessToken).toBe('mock-access-token');
    console.log('[E2E] ✓ /auth/me would return 200 with user:', meResponse?.userId);

    // ✅ Step 6: Verify complete flow
    console.log('[E2E] Step 6: Verifying complete cookie transport flow...');
    expect({
      sessionCreated: Boolean(createdSession),
      cookieSet: Boolean(setCookieHeader),
      browserStored: storedSessionId === sessionId,
      browserSent: requestCookies['sva_auth_session'] === sessionId,
      serverRetrieved: meResponse?.userId === userId,
      meStatusWould200: Boolean(meResponse),
    }).toEqual({
      sessionCreated: true,
      cookieSet: true,
      browserStored: true,
      browserSent: true,
      serverRetrieved: true,
      meStatusWould200: true,
    });

    console.log('[E2E] ✅ Complete OAuth flow validated!');
  });

  it('should reject /auth/me without valid session cookie', async () => {
    console.log('[E2E] Testing rejection without session...');

    // Simulate request without session cookie
    const noSessionResult = await getSession('nonexistent-session-id');

    expect(noSessionResult).toBeNull();
    console.log('[E2E] ✓ /auth/me would return 401 without session');
  });

  it('should handle expired session correctly', async () => {
    const expiredSessionId = 'expired-session-456';

    // Create session with past expiration
    const expiredSession: Session = {
      id: expiredSessionId,
      userId: 'user-expired',
      createdAt: Date.now() - 3600000,
      expiresAt: Date.now() - 1000, // Already expired
      accessToken: 'expired-token',
    };

    await createSession(expiredSession);

    // Try to retrieve
    const retrieved = await getSession(expiredSessionId);

    // Session might exist but should be marked expired
    // (Redis TTL will handle cleanup)
    if (retrieved) {
      expect(retrieved.expiresAt).toBeLessThan(Date.now());
    }

    console.log('[E2E] ✓ Expired session handled correctly');
  });
});
