import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORKSPACE_ID,
  PLATFORM_WORKSPACE_ID,
  getRuntimeScopeRef,
  getScopeFromAuthConfig,
  getWorkspaceIdForScope,
  isPlatformScope,
} from './scope.js';

describe('runtime scope helpers', () => {
  it('maps scope refs to stable workspace ids', () => {
    expect(getWorkspaceIdForScope()).toBeUndefined();
    expect(getWorkspaceIdForScope({ kind: 'platform' })).toBe(PLATFORM_WORKSPACE_ID);
    expect(getWorkspaceIdForScope({ kind: 'instance', instanceId: 'tenant-a' })).toBe('tenant-a');
  });

  it('derives runtime scopes from explicit kind and workspace inputs', () => {
    expect(getRuntimeScopeRef({ kind: 'platform', instanceId: 'ignored' })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ kind: 'instance', instanceId: 'tenant-a' })).toEqual({
      kind: 'instance',
      instanceId: 'tenant-a',
    });
    expect(getRuntimeScopeRef({ scopeKind: 'platform' })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ scopeKind: 'instance', instanceId: 'tenant-b' })).toEqual({
      kind: 'instance',
      instanceId: 'tenant-b',
    });
    expect(getRuntimeScopeRef({ instanceId: 'tenant-c' })).toEqual({
      kind: 'instance',
      instanceId: 'tenant-c',
    });
    expect(getRuntimeScopeRef({ workspaceId: PLATFORM_WORKSPACE_ID })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ workspaceId: 'tenant-d' })).toEqual({
      kind: 'instance',
      instanceId: 'tenant-d',
    });
    expect(getRuntimeScopeRef({ workspaceId: DEFAULT_WORKSPACE_ID })).toBeUndefined();
  });

  it('derives scopes from auth config and recognizes platform scope', () => {
    expect(
      getScopeFromAuthConfig({
        kind: 'platform',
        issuer: 'issuer',
        clientId: 'client',
        clientSecret: 'secret',
        loginStateSecret: 'state',
        redirectUri: 'https://app/auth/callback',
        postLogoutRedirectUri: 'https://app/',
        scopes: 'openid',
        sessionCookieName: 'session',
        loginStateCookieName: 'state-cookie',
        silentSsoSuppressCookieName: 'silent',
        sessionTtlMs: 1,
        sessionRedisTtlBufferMs: 1,
        silentSsoSuppressAfterLogoutMs: 1,
      })
    ).toEqual({ kind: 'platform' });

    expect(
      getScopeFromAuthConfig({
        kind: 'instance',
        instanceId: 'tenant-a',
        authRealm: 'tenant',
        issuer: 'issuer',
        clientId: 'client',
        clientSecret: 'secret',
        loginStateSecret: 'state',
        redirectUri: 'https://tenant/auth/callback',
        postLogoutRedirectUri: 'https://tenant/',
        scopes: 'openid',
        sessionCookieName: 'session',
        loginStateCookieName: 'state-cookie',
        silentSsoSuppressCookieName: 'silent',
        sessionTtlMs: 1,
        sessionRedisTtlBufferMs: 1,
        silentSsoSuppressAfterLogoutMs: 1,
      })
    ).toEqual({ kind: 'instance', instanceId: 'tenant-a' });

    expect(isPlatformScope({ kind: 'platform' })).toBe(true);
    expect(isPlatformScope({ kind: 'instance', instanceId: 'tenant-a' })).toBe(false);
  });
});
