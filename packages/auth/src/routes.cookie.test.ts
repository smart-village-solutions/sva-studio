import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serialize as serializeCookie } from 'cookie-es';

describe('Cookie Handling', () => {
  describe('serializeCookie', () => {
    it('should serialize a cookie with name and value', () => {
      const result = serializeCookie('sessionId', 'abc-123');
      expect(result).toBe('sessionId=abc-123');
    });

    it('should include Path flag', () => {
      const result = serializeCookie('sessionId', 'abc-123', { path: '/' });
      expect(result).toContain('Path=/');
    });

    it('should include HttpOnly flag', () => {
      const result = serializeCookie('sessionId', 'abc-123', { httpOnly: true });
      expect(result).toContain('HttpOnly');
    });

    it('should include SameSite flag', () => {
      const result = serializeCookie('sessionId', 'abc-123', {
        sameSite: 'lax',
      });
      expect(result).toContain('SameSite=Lax');
    });

    it('should include Secure flag for production', () => {
      const result = serializeCookie('sessionId', 'abc-123', {
        secure: true,
      });
      expect(result).toContain('Secure');
    });

    it('should combine all security flags correctly', () => {
      const result = serializeCookie('sva_auth_session', 'session-id-123', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });

      expect(result).toContain('sva_auth_session=session-id-123');
      expect(result).toContain('Path=/');
      expect(result).toContain('HttpOnly');
      expect(result).toContain('Secure');
      expect(result).toContain('SameSite=Lax');
    });

    it('should include Max-Age for delete cookies', () => {
      const result = serializeCookie('sessionId', '', { maxAge: 0 });
      expect(result).toContain('Max-Age=0');
    });

    it('should serialize empty value for cookie deletion', () => {
      const result = serializeCookie('sessionId', '', {
        path: '/',
        maxAge: 0,
      });

      expect(result).toContain('sessionId=');
      expect(result).toContain('Max-Age=0');
      expect(result).toContain('Path=/');
    });
  });

  describe('Response Headers with Set-Cookie', () => {
    it('should create Response with Set-Cookie header', () => {
      const sessionCookie = serializeCookie('sva_auth_session', 'session-123', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      const headers = new Headers();
      headers.append('Set-Cookie', sessionCookie);

      expect(headers.get('set-cookie')).toContain('sva_auth_session=session-123');
    });

    it('should support multiple Set-Cookie headers', () => {
      const sessionCookie = serializeCookie('sva_auth_session', 'session-123', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      const deleteCookie = serializeCookie('sva_auth_state', '', {
        path: '/',
        maxAge: 0,
      });

      const headers = new Headers();
      headers.append('Set-Cookie', sessionCookie);
      headers.append('Set-Cookie', deleteCookie);

      // Note: Headers.get() returns only the last value when using append()
      // We need to check the raw entries
      const entries = Array.from(headers.entries());
      const setCookieHeaders = entries.filter(([key]) => key === 'set-cookie');

      expect(setCookieHeaders.length).toBe(2);
      expect(setCookieHeaders[0][1]).toContain('sva_auth_session');
      expect(setCookieHeaders[1][1]).toContain('sva_auth_state');
    });

    it('should create 302 redirect Response with Set-Cookie', () => {
      const sessionCookie = serializeCookie('sva_auth_session', 'session-456', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      const headers = new Headers();
      headers.set('Location', '/?auth=ok');
      headers.append('Set-Cookie', sessionCookie);

      const response = new Response(null, { status: 302, headers });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/?auth=ok');
      expect(response.headers.get('set-cookie')).toContain('sva_auth_session=session-456');
    });
  });

  describe('Cookie Request Headers', () => {
    it('should parse Cookie header from request', () => {
      const cookieHeader = 'sva_auth_session=abc-123; other_cookie=value';

      // Simulate what happens in meHandler
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((pair) => {
        const [key, value] = pair.trim().split('=');
        cookies[key] = value;
      });

      expect(cookies['sva_auth_session']).toBe('abc-123');
      expect(cookies['other_cookie']).toBe('value');
    });

    it('should handle empty Cookie header', () => {
      const cookieHeader = '';

      const cookies: Record<string, string> = {};
      if (cookieHeader) {
        cookieHeader.split(';').forEach((pair) => {
          const [key, value] = pair.trim().split('=');
          cookies[key] = value;
        });
      }

      expect(Object.keys(cookies).length).toBe(0);
    });

    it('should extract session ID from Cookie header', () => {
      const cookieHeader = 'sva_auth_session=xyz-789';

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((pair) => {
        const [key, value] = pair.trim().split('=');
        cookies[key] = value;
      });

      const sessionId = cookies['sva_auth_session'];

      expect(sessionId).toBe('xyz-789');
    });

    it('should return undefined if session cookie not present', () => {
      const cookieHeader = 'other_cookie=value';

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((pair) => {
        const [key, value] = pair.trim().split('=');
        cookies[key] = value;
      });

      const sessionId = cookies['sva_auth_session'];

      expect(sessionId).toBeUndefined();
    });
  });
});
