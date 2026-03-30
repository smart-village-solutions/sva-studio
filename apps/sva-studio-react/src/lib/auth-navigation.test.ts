import { describe, expect, it, vi } from 'vitest';

import { createLoginHref, resolveCurrentReturnTo } from './auth-navigation';

describe('auth-navigation', () => {
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
});
