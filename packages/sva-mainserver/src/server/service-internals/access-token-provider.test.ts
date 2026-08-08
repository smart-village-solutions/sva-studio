import { describe, expect, it, vi } from 'vitest';

import type { SvaMainserverInstanceConfig } from '../../types.js';
import { createAccessTokenProvider } from './access-token-provider.js';

const config: SvaMainserverInstanceConfig = {
  instanceId: 'tenant-1',
  providerKey: 'sva_mainserver',
  graphqlBaseUrl: 'https://mainserver.test/graphql',
  oauthTokenUrl: 'https://mainserver.test/oauth/token',
  enabled: true,
};

describe('access token cache isolation', () => {
  it('never reuses tokens across principal or credential-version contexts', async () => {
    let tokenSequence = 0;
    const fetchWithRetry = vi.fn(async () =>
      Response.json({ access_token: `token-${++tokenSequence}`, expires_in: 3600 })
    );
    const loadCredentials = vi.fn(
      async (connection: {
        readonly actingPrincipalType?: 'organization' | 'user';
        readonly credentialFingerprint?: string;
      }) => ({
        apiKey: `${connection.actingPrincipalType}-key`,
        apiSecret: `${connection.actingPrincipalType}-secret`,
        ...(connection.actingPrincipalType
          ? { credentialSource: connection.actingPrincipalType }
          : {}),
        ...(connection.credentialFingerprint
          ? { credentialFingerprint: connection.credentialFingerprint }
          : {}),
      })
    );
    const loadToken = createAccessTokenProvider({
      now: () => 1_000,
      tokenSkewMs: 60_000,
      tokenCacheMaxSize: 16,
      loadCredentials,
      fetchWithRetry,
    });
    const base = { instanceId: 'tenant-1', keycloakSubject: 'subject-1' };
    const user = {
      ...base,
      actingPrincipalType: 'user' as const,
      credentialFingerprint: 'user-v1',
    };
    const organization = {
      ...base,
      activeOrganizationId: 'org-1',
      actingPrincipalType: 'organization' as const,
      credentialFingerprint: 'org-v1',
    };

    await expect(loadToken(user, config)).resolves.toBe('token-1');
    await expect(loadToken(organization, config)).resolves.toBe('token-2');
    await expect(loadToken(user, config)).resolves.toBe('token-1');
    await expect(loadToken(organization, config)).resolves.toBe('token-2');
    await expect(
      loadToken({ ...organization, credentialFingerprint: 'org-v2' }, config)
    ).resolves.toBe('token-3');

    expect(fetchWithRetry).toHaveBeenCalledTimes(3);
  });
});
