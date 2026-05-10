import { describe, expect, it, vi } from 'vitest';

import { TOKEN_REFRESH_SKEW_MS, buildSessionUser, resolveExpiresAt, resolveSessionExpiry } from './shared.js';
import { TenantScopeConflictError } from '../runtime-errors.js';

describe('auth-server shared helpers', () => {
  it('exposes the token refresh skew constant', () => {
    expect(TOKEN_REFRESH_SKEW_MS).toBe(60_000);
  });

  it('merges token claims and scope while preferring preferred_username', () => {
    const accessToken = `ignored.${Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        preferred_username: 'alice',
        email: 'alice@example.org',
        realm_access: { roles: ['viewer'] },
        instance_id: 'instance-from-token',
      })
    ).toString('base64url')}.sig`;

    expect(
      buildSessionUser({
        accessToken,
        claims: {
          given_name: 'Alice',
          family_name: 'Example',
          name: 'Alice Example',
        },
        clientId: 'sva-studio',
        scope: {
          kind: 'instance',
          instanceId: 'instance-from-token',
        },
      })
    ).toMatchObject({
      id: 'user-1',
      instanceId: 'instance-from-token',
      username: 'alice',
      email: 'alice@example.org',
      firstName: 'Alice',
      lastName: 'Example',
      displayName: 'Alice Example',
    });
  });

  it('throws on conflicting tenant scopes and falls back to the keycloak subject', () => {
    const conflictingAccessToken = `ignored.${Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        username: 'alice',
        realm_access: { roles: [] },
        instanceId: 'tenant-a',
      })
    ).toString('base64url')}.sig`;

    expect(() =>
      buildSessionUser({
        accessToken: conflictingAccessToken,
        claims: {},
        clientId: 'sva-studio',
        scope: {
          kind: 'instance',
          instanceId: 'tenant-b',
        },
      })
    ).toThrow(TenantScopeConflictError);

    expect(
      buildSessionUser({
        claims: {
          sub: 'user-2',
          instanceId: 'tenant-a',
          username: 'bob',
        },
        clientId: 'sva-studio',
      })
    ).toMatchObject({
      id: 'user-2',
      username: 'bob',
      displayName: undefined,
    });
  });

  it('derives expiry timestamps with fallback and absolute session limits', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    expect(resolveExpiresAt(undefined, 5_000)).toBe(5_000);
    expect(resolveExpiresAt(2)).toBe(3_000);
    expect(
      resolveSessionExpiry({
        expiresInSeconds: undefined,
        issuedAt: 10_000,
        sessionTtlMs: 5_000,
      })
    ).toBe(15_000);
    expect(
      resolveSessionExpiry({
        expiresInSeconds: 10,
        issuedAt: 10_000,
        sessionTtlMs: 50_000,
        fallback: 99_000,
      })
    ).toBe(11_000);

    vi.restoreAllMocks();
  });
});
