import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORKSPACE_ID,
  PLATFORM_WORKSPACE_ID,
  getRuntimeScopeRef,
  getScopeFromAuthConfig,
  getWorkspaceIdForScope,
  isPlatformScope,
} from './scope.js';

describe('scope helpers', () => {
  it('maps platform and instance scopes to workspace ids', () => {
    expect(getWorkspaceIdForScope()).toBeUndefined();
    expect(getWorkspaceIdForScope({ kind: 'platform' })).toBe(PLATFORM_WORKSPACE_ID);
    expect(getWorkspaceIdForScope({ kind: 'instance', instanceId: 'de-musterhausen' })).toBe('de-musterhausen');
  });

  it('resolves explicit kind and falls back from workspace ids compatibly', () => {
    expect(getRuntimeScopeRef({ kind: 'platform', instanceId: 'ignored' })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ kind: 'instance', instanceId: 'hb' })).toEqual({
      kind: 'instance',
      instanceId: 'hb',
    });
    expect(getRuntimeScopeRef({ scopeKind: 'platform' })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ scopeKind: 'instance', instanceId: 'demo' })).toEqual({
      kind: 'instance',
      instanceId: 'demo',
    });
    expect(getRuntimeScopeRef({ workspaceId: PLATFORM_WORKSPACE_ID })).toEqual({ kind: 'platform' });
    expect(getRuntimeScopeRef({ workspaceId: 'de-musterhausen' })).toEqual({
      kind: 'instance',
      instanceId: 'de-musterhausen',
    });
    expect(getRuntimeScopeRef({ workspaceId: DEFAULT_WORKSPACE_ID })).toBeUndefined();
  });

  it('derives scopes from auth config and identifies platform scope', () => {
    expect(
      getScopeFromAuthConfig({
        kind: 'platform',
        issuer: 'https://keycloak.local/realms/platform',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'http://studio.lvh.me:3000/auth/callback',
        postLogoutRedirectUri: 'http://studio.lvh.me:3000',
        scopes: ['openid'],
        authorizationEndpoint: 'https://keycloak.local/auth',
        tokenEndpoint: 'https://keycloak.local/token',
        userInfoEndpoint: 'https://keycloak.local/userinfo',
        endSessionEndpoint: 'https://keycloak.local/logout',
      })
    ).toEqual({ kind: 'platform' });

    expect(
      getScopeFromAuthConfig({
        kind: 'instance',
        instanceId: 'demo',
        issuer: 'https://keycloak.local/realms/demo',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'http://demo.studio.lvh.me:3000/auth/callback',
        postLogoutRedirectUri: 'http://demo.studio.lvh.me:3000',
        scopes: ['openid'],
        authorizationEndpoint: 'https://keycloak.local/auth',
        tokenEndpoint: 'https://keycloak.local/token',
        userInfoEndpoint: 'https://keycloak.local/userinfo',
        endSessionEndpoint: 'https://keycloak.local/logout',
      })
    ).toEqual({ kind: 'instance', instanceId: 'demo' });

    expect(isPlatformScope({ kind: 'platform' })).toBe(true);
    expect(isPlatformScope({ kind: 'instance', instanceId: 'demo' })).toBe(false);
    expect(isPlatformScope()).toBe(false);
  });
});
