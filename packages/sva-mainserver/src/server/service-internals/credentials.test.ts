import { describe, expect, it, vi } from 'vitest';

import { createCredentialProvider } from './credentials.js';

describe('credential provider cache isolation', () => {
  it('separates principal, organization and credential-version contexts', async () => {
    const readCredentials = vi.fn(
      async (input: {
        readonly activeOrganizationId?: string;
        readonly actingPrincipalType?: 'organization' | 'user';
      }) => {
        const fingerprint =
          input.actingPrincipalType === 'organization'
            ? input.activeOrganizationId === 'org-2'
              ? 'org-2-v1'
              : 'org-1-v1'
            : 'user-v1';
        return {
          apiKey: `${fingerprint}-key`,
          apiSecret: `${fingerprint}-secret`,
          ...(input.actingPrincipalType ? { credentialSource: input.actingPrincipalType } : {}),
          ...(input.activeOrganizationId
            ? { credentialOrganizationId: input.activeOrganizationId }
            : {}),
          credentialFingerprint: fingerprint,
        };
      }
    );
    const load = createCredentialProvider({
      readCredentials,
      now: () => 1_000,
      credentialCacheTtlMs: 60_000,
      credentialCacheMaxSize: 16,
    });
    const base = { instanceId: 'tenant-1', keycloakSubject: 'subject-1' };

    await expect(
      load({ ...base, actingPrincipalType: 'user', credentialFingerprint: 'user-v1' })
    ).resolves.toMatchObject({ credentialSource: 'user' });
    await expect(
      load({
        ...base,
        activeOrganizationId: 'org-1',
        actingPrincipalType: 'organization',
        credentialFingerprint: 'org-1-v1',
      })
    ).resolves.toMatchObject({ credentialSource: 'organization' });
    await load({ ...base, actingPrincipalType: 'user', credentialFingerprint: 'user-v1' });
    await load({
      ...base,
      activeOrganizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'org-1-v1',
    });
    await load({
      ...base,
      activeOrganizationId: 'org-2',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'org-2-v1',
    });

    expect(readCredentials).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the resolved credential version changed', async () => {
    const load = createCredentialProvider({
      readCredentials: vi.fn(async () => ({
        apiKey: 'new-key',
        apiSecret: 'new-secret',
        credentialSource: 'user' as const,
        credentialFingerprint: 'user-v2',
      })),
      now: () => 1_000,
      credentialCacheTtlMs: 60_000,
      credentialCacheMaxSize: 16,
    });

    await expect(
      load({
        instanceId: 'tenant-1',
        keycloakSubject: 'subject-1',
        actingPrincipalType: 'user',
        credentialFingerprint: 'user-v1',
      })
    ).rejects.toMatchObject({ code: 'credential_context_changed', statusCode: 409 });
  });
});
