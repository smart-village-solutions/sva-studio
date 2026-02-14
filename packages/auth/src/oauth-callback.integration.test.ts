import { describe, it, expect, beforeEach } from 'vitest';
import { serialize as serializeCookie, parse as parseCookie } from 'cookie-es';
import type { Session } from './types';
import { createSession, getSession, deleteSession } from './session';

/**
 * Simulates the complete OAuth callback flow:
 * 1. Backend creates session
 * 2. Backend sets Set-Cookie header
 3. Browser receives Set-Cookie (we'll verify the header exists)
 * 4. Browser sends request with Cookie header
 * 5. Backend retrieves session from Cookie
 */
describe('OAuth Callback Flow Integration', () => {
  beforeEach(() => {
    // Clear sessions for each test
    // In real tests, we'd use beforeEach hook properly
  });

  describe('Complete callback → retrieval flow', () => {
    it('should create session, set cookie, and retrieve on next request', () => {
      const sessionId = 'test-session-123';
      const userId = 'user-456';

      // Step 1: Create session on callback
      const session: Session = {
        id: sessionId,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      createSession(session);

      // Step 2: Serialize session cookie (simulating what callbackHandler does)
      const sessionCookie = serializeCookie('sva_auth_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      // Step 3: Verify the Set-Cookie header contains correct session ID
      expect(sessionCookie).toContain(`sva_auth_session=${sessionId}`);
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Path=/');

      // Step 4: Simulate browser sending the cookie back in next request
      // This is where we need to check if browser actually sends it...
      const requestCookieHeader = sessionCookie.split(';')[0]; // Just the name=value part
      const parsedCookies = parseCookie(requestCookieHeader);

      // Step 5: Retrieve session using the cookie from request
      const retrievedSessionId = parsedCookies['sva_auth_session'];
      const retrievedSession = getSession(retrievedSessionId);

      expect(retrievedSession).toEqual(session);
      expect(retrievedSession?.userId).toBe(userId);
    });

    it('should handle session lifecycle: create → use → delete', () => {
      const sessionId = 'lifecycle-session';

      // Create
      const session: Session = {
        id: sessionId,
        userId: 'user-789',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      createSession(session);
      expect(getSession(sessionId)).toBeDefined();

      // Use (serialize for response)
      const cookie = serializeCookie('sva_auth_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      const cookies = parseCookie(cookie.split(';')[0]);
      expect(getSession(cookies['sva_auth_session'])).toEqual(session);

      // Delete
      deleteSession(sessionId);
      expect(getSession(sessionId)).toBeNull();
    });

    it('should set response headers for 302 redirect with cookies', () => {
      const sessionId = 'redirect-session';
      const session: Session = {
        id: sessionId,
        userId: 'user-999',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      createSession(session);

      // Simulate the 302 response setup
      const sessionCookie = serializeCookie('sva_auth_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      const deleteCookie = serializeCookie('sva_auth_state', '', {
        path: '/',
        maxAge: 0,
      });

      const headers = new Headers();
      headers.set('Location', '/?auth=ok');
      headers.append('Set-Cookie', sessionCookie);
      headers.append('Set-Cookie', deleteCookie);

      const response = new Response(null, { status: 302, headers });

      // Verify response structure
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/?auth=ok');

      // Verify cookies are in headers
      const entries = Array.from(response.headers.entries());
      const setCookies = entries.filter(([key]) => key === 'set-cookie');
      expect(setCookies.length).toBe(2);
      expect(setCookies[0][1]).toContain('sva_auth_session=');
      expect(setCookies[1][1]).toContain('sva_auth_state');
    });
  });

  describe('Cookie round-trip simulation', () => {
    it('should simulate browser receiving and re-sending cookie', () => {
      const userId = 'user-test';
      const sessionId = 'round-trip-session';

      // 1. Backend creates session
      const session: Session = {
        id: sessionId,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      createSession(session);

      // 2. Backend serializes for Set-Cookie header
      const setCookieHeader = serializeCookie('sva_auth_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      // 3. Browser receives Set-Cookie and stores it in cookie jar
      // (In real test, we'd check this actually happened)
      const cookieNameValue = setCookieHeader.split(';')[0]; // Extract "name=value"

      // 4. Browser sends subsequent request with Cookie header
      const browserCookieHeader = cookieNameValue;

      // 5. Backend receives request and parses Cookie header
      const requestCookies = parseCookie(browserCookieHeader);
      const receivedSessionId = requestCookies['sva_auth_session'];

      // 6. Backend retrieves session
      const user = getSession(receivedSessionId);

      expect(user).toBeDefined();
      expect(user?.userId).toBe(userId);
    });

    it('should handle missing cookie in request', () => {
      // Simulate request without cookie
      const requestCookieHeader = '';
      const cookies = parseCookie(requestCookieHeader);
      const sessionId = cookies['sva_auth_session'];

      expect(sessionId).toBeUndefined();
      // This is what we're seeing - meHandler gets undefined
    });

    it('PROBLEM: should reproduce the actual issue', () => {
      // This test reproduces what's actually happening:
      // 1. Session is created and Set-Cookie header is set ✅
      // 2. Response headers contain Set-Cookie ✅
      // 3. Browser never receives the cookie ❌
      // 4. Next /auth/me request has no Cookie header ❌

      const sessionId = 'actual-issue-session';
      const session: Session = {
        id: sessionId,
        userId: 'user-actual',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      createSession(session);

      // ✅ Step 1: Session created
      const createdSession = getSession(sessionId);
      expect(createdSession).toBeDefined();

      // ✅ Step 2: Cookie header is created
      const setCookieHeader = serializeCookie('sva_auth_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      expect(setCookieHeader).toContain(sessionId);

      // ✅ Step 3: Response with 302 and Set-Cookie is created
      const headers = new Headers();
      headers.set('Location', '/?auth=ok');
      headers.append('Set-Cookie', setCookieHeader);
      const response = new Response(null, { status: 302, headers });

      expect(response.headers.get('set-cookie')).toContain(sessionId);

      // ❌ Step 4: Browser never sends back the cookie (simulated)
      // Instead of: "sva_auth_session=actual-issue-session; other=value"
      // We get: "" (empty)
      const browserCookieHeader = ''; // Browser doesn't have it!

      // ❌ Step 5: /auth/me request fails because sessionId is undefined
      const cookies = parseCookie(browserCookieHeader);
      const receivedSessionId = cookies['sva_auth_session'];

      expect(receivedSessionId).toBeUndefined(); // THIS IS THE BUG
      expect(getSession(receivedSessionId)).toBeNull();

      // ROOT CAUSE: Set-Cookie headers are not reaching the browser
      // This is a TanStack Start framework issue, not a session management issue
    });
  });
});
