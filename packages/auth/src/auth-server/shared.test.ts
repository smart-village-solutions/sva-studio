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
}));

import { buildSessionUser, resolveExpiresAt, resolveSessionExpiry } from './shared.ts';

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
      instanceId: 'instance-1',
      roles: ['Admin', 'system_admin'],
      email: 'merged@example.com',
    });
  });

  it('supports claims-only session hydration without an access token', () => {
    const user = buildSessionUser({
      claims: {
        sub: 'user-2',
        instanceId: 'instance-2',
        preferred_username: 'jane.doe',
        email: 'jane@example.com',
        given_name: 'Jane',
        family_name: 'Doe',
        name: 'Jane Doe',
        roles: ['viewer'],
      },
      clientId: 'sva-client',
    });

    expect(user).toEqual({
      id: 'user-2',
      instanceId: 'instance-2',
      roles: ['viewer'],
      username: 'jane.doe',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
    });
  });

  it('uses the tenant auth scope as instance context when the token has no instanceId claim', () => {
    const user = buildSessionUser({
      claims: {
        sub: 'tenant-user-1',
        preferred_username: 'tenant.user',
        roles: ['viewer'],
      },
      clientId: 'sva-client',
      scope: { kind: 'instance', instanceId: 'bb-guben' },
    });

    expect(user).toEqual({
      id: 'tenant-user-1',
      instanceId: 'bb-guben',
      roles: ['viewer'],
      username: 'tenant.user',
      email: undefined,
      firstName: undefined,
      lastName: undefined,
      displayName: 'tenant.user',
    });
  });

  it('keeps platform scope tenant-less even when an optional instanceId claim exists', () => {
    const user = buildSessionUser({
      claims: {
        sub: 'platform-user-1',
        instanceId: 'legacy-claim',
        roles: ['viewer'],
      },
      clientId: 'sva-client',
      scope: { kind: 'platform' },
    });

    expect(user.instanceId).toBeUndefined();
  });

  it('fails closed when an instance-scoped token carries a conflicting instanceId claim', () => {
    expect(() =>
      buildSessionUser({
        claims: {
          sub: 'tenant-user-2',
          instanceId: 'other-tenant',
          roles: ['viewer'],
        },
        clientId: 'sva-client',
        scope: { kind: 'instance', instanceId: 'bb-guben' },
      })
    ).toThrow('Tenant login token contains a conflicting instance context');
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

  it('uses the absolute session ttl when token expiry is missing', () => {
    const issuedAt = 1_700_000_000_000;

    expect(
      resolveSessionExpiry({
        expiresInSeconds: undefined,
        issuedAt,
        sessionTtlMs: 600_000,
      })
    ).toBe(issuedAt + 600_000);
  });

  it('prefers the earlier token expiry when both token and session expiry exist', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    const issuedAt = Date.now();

    expect(
      resolveSessionExpiry({
        expiresInSeconds: 120,
        issuedAt,
        sessionTtlMs: 600_000,
      })
    ).toBe(issuedAt + 120_000);

    vi.useRealTimers();
  });

  it('caps token expiry at session ttl when token lifetime is longer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    const issuedAt = Date.now();

    expect(
      resolveSessionExpiry({
        expiresInSeconds: 3600,
        issuedAt,
        sessionTtlMs: 600_000,
      })
    ).toBe(issuedAt + 600_000);

    vi.useRealTimers();
  });
});
