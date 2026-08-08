import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readEffective: vi.fn(),
}));

vi.mock('./mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: state.readEffective,
}));

describe('resolveMutationPrincipalContext', () => {
  let resolveMutationPrincipalContext: typeof import('./mainserver-mutation-principal.js').resolveMutationPrincipalContext;

  beforeAll(async () => {
    ({ resolveMutationPrincipalContext } = await import('./mainserver-mutation-principal.js'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('binds the organization and credential fingerprint immutably', async () => {
    state.readEffective.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      organizationId: '22222222-2222-2222-8222-222222222222',
      credentials: { apiKey: 'org-key', apiSecret: 'org-secret' },
      credentialFingerprint: 'a'.repeat(64),
    });

    const result = await resolveMutationPrincipalContext({
      instanceId: 'de-musterhausen',
      actorAccountId: '11111111-1111-1111-8111-111111111111',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
      actingPrincipalType: 'organization',
    });

    expect(result).toEqual({
      ok: true,
      context: {
        version: 1,
        instanceId: 'de-musterhausen',
        actorAccountId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '22222222-2222-2222-8222-222222222222',
        actingPrincipalType: 'organization',
        actingPrincipalId: '22222222-2222-2222-8222-222222222222',
        credentialSource: 'organization',
        credentialFingerprint: 'a'.repeat(64),
      },
    });
    expect(result.ok && Object.isFrozen(result.context)).toBe(true);
  });

  it('uses the actor account as personal principal', async () => {
    state.readEffective.mockResolvedValue({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'user-key', apiSecret: 'user-secret' },
      credentialFingerprint: 'b'.repeat(64),
    });

    const result = await resolveMutationPrincipalContext({
      instanceId: 'de-musterhausen',
      actorAccountId: '11111111-1111-1111-8111-111111111111',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
      actingPrincipalType: 'user',
    });

    expect(result).toMatchObject({
      ok: true,
      context: {
        actingPrincipalId: '11111111-1111-1111-8111-111111111111',
        credentialSource: 'user',
      },
    });
  });

  it('derives the legacy transition principal from the policy-driven credential source', async () => {
    state.readEffective.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      organizationId: '22222222-2222-2222-8222-222222222222',
      credentials: { apiKey: 'org-key', apiSecret: 'org-secret' },
      credentialFingerprint: 'c'.repeat(64),
    });

    await expect(
      resolveMutationPrincipalContext({
        instanceId: 'de-musterhausen',
        actorAccountId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '22222222-2222-2222-8222-222222222222',
      })
    ).resolves.toMatchObject({
      ok: true,
      context: {
        actingPrincipalType: 'organization',
        actingPrincipalId: '22222222-2222-2222-8222-222222222222',
        credentialSource: 'organization',
        credentialFingerprint: 'c'.repeat(64),
      },
    });
    expect(state.readEffective).toHaveBeenCalledWith(
      expect.not.objectContaining({ actingPrincipalType: expect.anything() })
    );
  });

  it('propagates deterministic credential resolution failures', async () => {
    state.readEffective.mockResolvedValue({
      status: 'organization_mainserver_credentials_missing',
    });

    await expect(
      resolveMutationPrincipalContext({
        instanceId: 'de-musterhausen',
        actorAccountId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'subject-1',
        actingPrincipalType: 'organization',
      })
    ).resolves.toEqual({
      ok: false,
      status: 'organization_mainserver_credentials_missing',
    });
  });

  it('rejects resolver drift to another credential source', async () => {
    state.readEffective.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      organizationId: '22222222-2222-2222-8222-222222222222',
      credentials: { apiKey: 'org-key', apiSecret: 'org-secret' },
      credentialFingerprint: 'a'.repeat(64),
    });

    await expect(
      resolveMutationPrincipalContext({
        instanceId: 'de-musterhausen',
        actorAccountId: '11111111-1111-1111-8111-111111111111',
        keycloakSubject: 'subject-1',
        activeOrganizationId: '22222222-2222-2222-8222-222222222222',
        actingPrincipalType: 'user',
      })
    ).resolves.toEqual({ ok: false, status: 'acting_principal_not_allowed' });
  });
});
