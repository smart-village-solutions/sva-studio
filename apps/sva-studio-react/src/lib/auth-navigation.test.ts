import { describe, expect, it, vi } from 'vitest';

import { createAccountActionHref, createLoginHref, createSessionExpiredHref, resolveCurrentReturnTo, sanitizeReturnTo } from './auth-navigation';

describe('auth-navigation', () => {
  it.each(['/\\evil.example/path', '/\t/evil.example/path', '/\n/evil.example/path', '/a/../auth/logout', '/a/..//evil.example/path', '/.//evil.example/path', '/%2e//evil.example/path'])(
    'rejects parser-normalized unsafe return target %j',
    (value) => {
      expect(sanitizeReturnTo(value)).toBe('/');
    }
  );

  it('preserves internal paths, encoded values, query strings and fragments', () => {
    expect(sanitizeReturnTo('/admin/users?q=%2F%5C#details')).toBe('/admin/users?q=%2F%5C#details');
  });

  it('resolves default returnTo on server runtime', () => {
    const windowSpy = vi.spyOn(globalThis, 'window', 'get');
    windowSpy.mockReturnValue(undefined as unknown as Window & typeof globalThis);

    expect(resolveCurrentReturnTo()).toBe('/');

    windowSpy.mockRestore();
  });

  it('creates login href with sanitized fallback for auth routes', () => {
    expect(createLoginHref('/auth/callback')).toBe('/auth/login?returnTo=%2F');
    expect(createLoginHref('//evil.example')).toBe('/auth/login?returnTo=%2F');
    expect(createLoginHref('https://evil.example')).toBe('/auth/login?returnTo=%2F');
  });

  it('creates login href with the current path and query when no returnTo is provided', () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/admin/users',
        search: '?tab=permissions',
      },
    });

    expect(createLoginHref()).toBe('/auth/login?returnTo=%2Fadmin%2Fusers%3Ftab%3Dpermissions');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('uses the session-expired returnTo when creating login hrefs from the notice page', () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/',
        search: '?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2',
      },
    });

    expect(resolveCurrentReturnTo()).toBe('/admin/users?page=2');
    expect(createLoginHref()).toBe('/auth/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('creates a safe session-expired notice href with the original target', () => {
    expect(createSessionExpiredHref('/admin/users?page=2')).toBe(
      '/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2'
    );
    expect(createSessionExpiredHref('https://evil.example')).toBe('/?auth=session-expired&returnTo=%2F');
  });

  it('creates account-action hrefs with a canonical account return target', () => {
    expect(createAccountActionHref('update-password')).toBe(
      '/auth/account-action?action=update-password&returnTo=%2Faccount'
    );
    expect(createAccountActionHref('update-email', '/auth/logout')).toBe(
      '/auth/account-action?action=update-email&returnTo=%2F'
    );
  });
});
