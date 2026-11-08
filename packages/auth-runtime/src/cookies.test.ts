import { createHash } from 'node:crypto';
import { createSilentSsoResponse } from './auth-route-cookies.js';
import { describe, expect, it } from 'vitest';

import { appendSetCookie, deleteCookieHeader, readCookieFromRequest } from './cookies.js';

describe('auth-runtime cookies', () => {
  it.each(['success', 'failure'] as const)('prepares a hash policy for the fixed silent-SSO %s script', async status => {
    const response = createSilentSsoResponse(status);
    const html = await response.text();
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toContain('window.location.origin');
    const hash = createHash('sha256').update(script ?? '').digest('base64');
    expect(response.headers.get('content-security-policy-report-only')).toBe(`script-src 'sha256-${hash}'; object-src 'none'; base-uri 'self'`);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

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
