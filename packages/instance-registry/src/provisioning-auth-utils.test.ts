import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
  equalSets,
  readPostLogoutUris,
  toSortedUnique,
} from './provisioning-auth-utils.js';

describe('provisioning-auth-utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds client origins from the public base protocol and falls back to https', () => {
    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'http://studio.example.test');
    expect(buildExpectedClientConfig('tenant.example.test')).toMatchObject({
      rootUrl: 'http://tenant.example.test',
      redirectUris: ['http://tenant.example.test/auth/callback'],
    });
    expect(buildExpectedTenantAdminClientConfig('tenant.example.test')).toMatchObject({
      rootUrl: 'http://tenant.example.test',
      serviceAccountsEnabled: true,
    });

    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'not-a-url');
    expect(buildExpectedClientConfig('tenant.example.test').rootUrl).toBe('https://tenant.example.test');
  });

  it('normalizes set-like values deterministically', () => {
    expect(toSortedUnique([' beta ', 'alpha', 'alpha', ''])).toEqual(['alpha', 'beta']);
    expect(equalSets(['alpha', ' beta '], ['beta', 'alpha'])).toBe(true);
    expect(equalSets(['alpha'], ['beta'])).toBe(false);
  });

  it('reads post-logout uris from keycloak attributes fail-closed', () => {
    expect(readPostLogoutUris(undefined)).toEqual([]);
    expect(readPostLogoutUris({ 'post.logout.redirect.uris': ' https://a ##  ## https://b ' })).toEqual([
      'https://a',
      'https://b',
    ]);
  });
});
