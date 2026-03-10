import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/core', () => ({
  extractRoles: vi.fn((claims: Record<string, unknown>, clientId: string) => {
    const roles = Array.isArray(claims.roles) ? claims.roles : [];
    return roles.includes('Admin') && clientId === 'sva-client' ? [...roles, 'system_admin'] : roles;
  }),
  parseJwtPayload: vi.fn((token: string) => {
    const payload = token.split('.')[1];
    return payload ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) : null;
  }),
  resolveInstanceId: vi.fn((claims: Record<string, unknown>) => claims.instanceId),
  resolveUserName: vi.fn((claims: Record<string, unknown>) => claims.preferred_username ?? claims.name ?? ''),
}));

import { buildSessionUser, resolveExpiresAt } from './shared.ts';

const createUnsignedJwt = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
};

describe('auth-server/shared', () => {
  it('prefers access-token claims for roles and merges identity claims', () => {
    const user = buildSessionUser({
      accessToken: createUnsignedJwt({
        sub: 'user-1',
        preferred_username: 'Access User',
        roles: ['Admin'],
      }),
      claims: {
        email: 'merged@example.com',
        instanceId: 'instance-1',
      },
      clientId: 'sva-client',
    });

    expect(user).toEqual({
      id: 'user-1',
      name: 'Access User',
      email: 'merged@example.com',
      instanceId: 'instance-1',
      roles: ['Admin', 'system_admin'],
    });
  });

  it('supports claims-only session hydration without an access token', () => {
    const user = buildSessionUser({
      claims: {
        sub: 'user-2',
        name: 'Claims User',
        email: 'claims@example.com',
        instanceId: 'instance-2',
        roles: ['viewer'],
      },
      clientId: 'sva-client',
    });

    expect(user).toEqual({
      id: 'user-2',
      name: 'Claims User',
      email: 'claims@example.com',
      instanceId: 'instance-2',
      roles: ['viewer'],
    });
  });

  it('keeps the fallback expiry when expiresIn is missing or zero', () => {
    expect(resolveExpiresAt(undefined, 123)).toBe(123);
    expect(resolveExpiresAt(0, 456)).toBe(456);
  });

  it('computes a future expiry when expiresIn is present', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    expect(resolveExpiresAt(60)).toBe(Date.now() + 60_000);

    vi.useRealTimers();
  });
});
