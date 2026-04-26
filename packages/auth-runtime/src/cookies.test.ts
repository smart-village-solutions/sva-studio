import { describe, expect, it } from 'vitest';

import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';

describe('auth-runtime cookies', () => {
  it('reads a named cookie from request headers', () => {
    const request = new Request('https://example.test', {
      headers: { cookie: 'session=abc; theme=dark' },
    });

    expect(readCookieFromRequest(request, 'session')).toBe('abc');
    expect(readCookieFromRequest(request, 'missing')).toBeUndefined();
  });

  it('appends set-cookie headers without replacing existing values', () => {
    const response = new Response(null);

    appendSetCookie(response, 'session=abc; Path=/');
    appendSetCookie(response, 'theme=dark; Path=/');

    expect(response.headers.getSetCookie()).toEqual(['session=abc; Path=/', 'theme=dark; Path=/']);
  });

  it('builds delete headers with matching cookie attributes', () => {
    const header = deleteCookieHeader('session', {
      domain: '.example.test',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });

    expect(header).toContain('session=');
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('Domain=.example.test');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');
  });
});
