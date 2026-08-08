import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EffectivePermission } from '@sva/iam-core';

import {
  authorizeMainserverCreatePrincipal,
  authorizeMainserverDataProviderAccess,
} from './mainserver-content-authorization.js';

const state = vi.hoisted(() => ({
  loadBinding: vi.fn(),
  readCredentials: vi.fn(),
}));

vi.mock('./mainserver-data-provider-bindings.js', () => ({
  loadCurrentMainserverDataProviderBinding: state.loadBinding,
}));

vi.mock('../mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: state.readCredentials,
}));

const permission = (accessScope?: 'all' | 'organization' | 'own'): EffectivePermission =>
  ({
    action: 'news.update',
    resourceType: 'news',
    ...(accessScope ? { accessScope } : {}),
  }) as EffectivePermission;

const context = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorAccountId: '11111111-1111-4111-8111-111111111111',
  activeOrganizationId: '22222222-2222-4222-8222-222222222222',
  action: 'news.update',
  contentType: 'news.article',
  contentId: 'news-1',
  actingPrincipalType: 'user',
  credentialFingerprint: 'a'.repeat(64),
} as const;

describe('Mainserver content authorization', () => {
  beforeEach(() => {
    process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE = 'automatic';
    state.loadBinding.mockReset();
    state.readCredentials.mockReset();
    state.readCredentials.mockImplementation(async (input: { actingPrincipalType: string }) => ({
      status: 'ok',
      source: input.actingPrincipalType,
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint:
        input.actingPrincipalType === 'organization' ? 'b'.repeat(64) : 'a'.repeat(64),
    }));
  });

  afterEach(() => {
    delete process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE;
  });

  it('enforces the create scope against the selected principal', () => {
    expect(
      authorizeMainserverCreatePrincipal({
        ...context,
        permissions: [permission('own')],
        actingPrincipalType: 'user',
      }).allowed
    ).toBe(true);
    expect(
      authorizeMainserverCreatePrincipal({
        ...context,
        permissions: [permission('own')],
        actingPrincipalType: 'organization',
      }).allowed
    ).toBe(false);
    expect(
      authorizeMainserverCreatePrincipal({
        ...context,
        permissions: [permission('organization')],
        actingPrincipalType: 'user',
      }).allowed
    ).toBe(true);
    expect(
      authorizeMainserverCreatePrincipal({
        ...context,
        permissions: [permission('organization')],
        actingPrincipalType: 'organization',
      }).allowed
    ).toBe(true);
  });

  it.each([
    ['own', 'user', true],
    ['own', 'organization', false],
    ['organization', 'user', true],
    ['organization', 'organization', true],
    ['all', 'user', true],
    ['all', 'organization', true],
  ] as const)(
    'evaluates create scope %s for the %s principal',
    (accessScope, actingPrincipalType, expectedAllowed) => {
      expect(
        authorizeMainserverCreatePrincipal({
          ...context,
          permissions: [permission(accessScope)],
          actingPrincipalType,
        })
      ).toMatchObject({
        allowed: expectedAllowed,
        authorizationMode: 'exact',
        resolverMode: 'automatic',
      });
    }
  );

  it('uses compatibility while the current own binding is missing', async () => {
    state.loadBinding.mockResolvedValue(undefined);
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toEqual({
      allowed: true,
      authorizationMode: 'credential_visible_compatibility',
      reason: 'allowed',
      resolverMode: 'automatic',
    });
  });

  it('rejects a missing DataProvider as an upstream contract failure', async () => {
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: '   ',
      })
    ).resolves.toEqual({
      allowed: false,
      authorizationMode: 'exact',
      reason: 'data_provider_missing',
      resolverMode: 'automatic',
    });
    expect(state.readCredentials).not.toHaveBeenCalled();
  });

  it('enforces the provider once the own binding is verified', async () => {
    state.loadBinding.mockResolvedValue({ dataProviderId: 'provider-user' });
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: 'provider-user',
      })
    ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toEqual({
      allowed: false,
      authorizationMode: 'exact',
      reason: 'data_provider_mismatch',
      resolverMode: 'automatic',
    });
  });

  it('keeps organization scope compatible until both bindings are current', async () => {
    state.loadBinding.mockImplementation(async (input: { principalType: string }) =>
      input.principalType === 'user' ? { dataProviderId: 'provider-user' } : undefined
    );
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('organization')],
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toMatchObject({
      allowed: true,
      authorizationMode: 'credential_visible_compatibility',
    });
  });

  it('enforces organization scope exactly once both current bindings exist', async () => {
    state.loadBinding.mockImplementation(async (input: { principalType: string }) => ({
      dataProviderId:
        input.principalType === 'organization' ? 'provider-organization' : 'provider-user',
    }));

    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('organization')],
        dataProviderId: 'provider-organization',
      })
    ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('organization')],
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toEqual({
      allowed: false,
      authorizationMode: 'exact',
      reason: 'data_provider_mismatch',
      resolverMode: 'automatic',
    });
    expect(state.readCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ actingPrincipalType: 'organization' })
    );
    expect(state.readCredentials).not.toHaveBeenCalledWith(
      expect.objectContaining({ actingPrincipalType: 'user' })
    );
    expect(state.loadBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        principalType: 'user',
        credentialFingerprint: 'a'.repeat(64),
      })
    );
  });

  it.each([
    ['user', 'c'.repeat(64), 'provider-user'],
    ['organization', 'd'.repeat(64), 'provider-organization'],
  ] as const)(
    'uses the immutable %s fingerprint for exact organization-scope evaluation',
    async (actingPrincipalType, credentialFingerprint, dataProviderId) => {
      state.loadBinding.mockImplementation(
        async (input: { principalType: 'organization' | 'user' }) => ({
          dataProviderId:
            input.principalType === 'organization' ? 'provider-organization' : 'provider-user',
        })
      );

      await expect(
        authorizeMainserverDataProviderAccess({
          ...context,
          actingPrincipalType,
          credentialFingerprint,
          permissions: [permission('organization')],
          dataProviderId,
        })
      ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });

      expect(state.loadBinding).toHaveBeenCalledWith(
        expect.objectContaining({
          principalType: actingPrincipalType,
          credentialFingerprint,
        })
      );
      expect(state.readCredentials).not.toHaveBeenCalledWith(
        expect.objectContaining({ actingPrincipalType })
      );
    }
  );

  it('evaluates organization scope as own when no active organization exists', async () => {
    state.loadBinding.mockResolvedValue({ dataProviderId: 'provider-user' });
    const withoutOrganization = {
      ...context,
      activeOrganizationId: undefined,
      permissions: [permission('organization')],
      actingPrincipalType: 'user' as const,
    };

    await expect(
      authorizeMainserverDataProviderAccess({
        ...withoutOrganization,
        dataProviderId: 'provider-user',
      })
    ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
    await expect(
      authorizeMainserverDataProviderAccess({
        ...withoutOrganization,
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toEqual({
      allowed: false,
      authorizationMode: 'exact',
      reason: 'data_provider_mismatch',
      resolverMode: 'automatic',
    });
  });

  it('defaults to shadow evaluation and records an exact denial without enforcing it', async () => {
    delete process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE;
    state.loadBinding.mockResolvedValue({ dataProviderId: 'provider-user' });

    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: 'provider-foreign',
      })
    ).resolves.toEqual({
      allowed: true,
      authorizationMode: 'credential_visible_compatibility',
      reason: 'allowed',
      resolverMode: 'shadow',
      candidateAuthorizationMode: 'exact',
      candidateAllowed: false,
      shadowDifference: true,
    });
  });

  it('provides a rollback mode that enforces credential-visible compatibility only', async () => {
    process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE = 'compatibility';
    state.loadBinding.mockResolvedValue({ dataProviderId: 'provider-user' });

    await expect(
      authorizeMainserverDataProviderAccess({
        ...context,
        permissions: [permission('own')],
        dataProviderId: 'provider-user',
      })
    ).resolves.toEqual({
      allowed: true,
      authorizationMode: 'credential_visible_compatibility',
      reason: 'allowed',
      resolverMode: 'compatibility',
    });
  });

  it('allows unscoped and all permissions without a binding', async () => {
    for (const accessScope of [undefined, 'all'] as const) {
      await expect(
        authorizeMainserverDataProviderAccess({
          ...context,
          permissions: [permission(accessScope)],
          dataProviderId: 'provider-foreign',
        })
      ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
    }
    expect(state.readCredentials).not.toHaveBeenCalled();
  });
});
