import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  readCredentials: vi.fn(),
  loadBinding: vi.fn(),
  loadTargets: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: vi.fn(async (_instanceId: string, callback: (client: unknown) => unknown) =>
    callback({ query: state.query })
  ),
}));
vi.mock('../mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: state.readCredentials,
}));
vi.mock('./mainserver-data-provider-bindings.js', () => ({
  loadCurrentMainserverDataProviderBinding: state.loadBinding,
}));
vi.mock('./repository.js', () => ({
  loadContentOwnershipTargets: state.loadTargets,
}));

import {
  listMainserverOwnershipTargets,
  resolveMainserverOwnershipSource,
  resolveMainserverOwnershipTarget,
} from './mainserver-content-ownership.js';
import { withMainserverOwnershipTargetBindingLock } from './mainserver-ownership-target-binding-lock.js';

const verifiedBinding = {
  id: 'binding-1',
  instanceId: 'instance-1',
  principalType: 'user',
  principalId: '11111111-1111-4111-8111-111111111111',
  credentialFingerprint: 'a'.repeat(64),
  dataProviderId: 'provider-target',
  dataProviderName: 'Zielanbieter',
  status: 'verified',
  evidenceKind: 'identity_endpoint',
  firstObservedAt: '2026-08-27T08:00:00.000Z',
  lastObservedAt: '2026-08-27T09:00:00.000Z',
};

describe('Mainserver ownership targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.query.mockResolvedValue({
      rows: [{ keycloak_subject: 'kc-target', is_active: true }],
    });
    state.readCredentials.mockResolvedValue({
      status: 'ok',
      source: 'user',
      credentials: { apiKey: 'key', apiSecret: 'secret' },
      credentialFingerprint: 'a'.repeat(64),
    });
    state.loadBinding.mockResolvedValue(verifiedBinding);
  });

  it('resolves an active account through current credentials and a verified binding', async () => {
    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toMatchObject({
      ok: true,
      target: {
        dataProviderId: 'provider-target',
        bindingVersion: 'binding-1:2026-08-27T09:00:00.000Z',
        connection: { keycloakSubject: 'kc-target', actingPrincipalType: 'user' },
      },
    });
  });

  it('derives the current owner only from one verified active DataProvider binding', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        {
          principal_type: 'organization',
          principal_id: '22222222-2222-4222-8222-222222222222',
          data_provider_id: 'provider-source',
          data_provider_name: 'Quellorganisation',
        },
      ],
    });

    await expect(
      resolveMainserverOwnershipSource({
        instanceId: 'instance-1',
        dataProviderId: 'provider-source',
      })
    ).resolves.toEqual({
      principal: {
        type: 'organization',
        id: '22222222-2222-4222-8222-222222222222',
      },
      dataProviderId: 'provider-source',
      dataProviderName: 'Quellorganisation',
    });
  });

  it('does not invent a source owner for ambiguous bindings', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        {
          principal_type: 'user',
          principal_id: '11111111-1111-4111-8111-111111111111',
          data_provider_id: 'provider-source',
          data_provider_name: null,
        },
        {
          principal_type: 'organization',
          principal_id: '22222222-2222-4222-8222-222222222222',
          data_provider_id: 'provider-source',
          data_provider_name: null,
        },
      ],
    });

    await expect(
      resolveMainserverOwnershipSource({
        instanceId: 'instance-1',
        dataProviderId: 'provider-source',
      })
    ).resolves.toBeUndefined();
  });

  it('uses organizational credentials without impersonating the target account', async () => {
    state.query.mockResolvedValue({ rows: [{ keycloak_subject: null, is_active: true }] });
    state.readCredentials.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      credentials: { apiKey: 'org-key', apiSecret: 'org-secret' },
      credentialFingerprint: 'b'.repeat(64),
    });
    state.loadBinding.mockResolvedValue({
      ...verifiedBinding,
      principalType: 'organization',
      principalId: '22222222-2222-4222-8222-222222222222',
      credentialFingerprint: 'b'.repeat(64),
    });

    const result = await resolveMainserverOwnershipTarget({
      instanceId: 'instance-1',
      actorKeycloakSubject: 'kc-actor',
      principal: { type: 'organization', id: '22222222-2222-4222-8222-222222222222' },
    });

    expect(result).toMatchObject({
      ok: true,
      target: {
        connection: {
          keycloakSubject: 'kc-actor',
          activeOrganizationId: '22222222-2222-4222-8222-222222222222',
          actingPrincipalType: 'organization',
        },
      },
    });
  });

  it('classifies a conflict and does not expose the unusable target', async () => {
    state.loadBinding.mockResolvedValue(undefined);
    state.query
      .mockResolvedValueOnce({ rows: [{ keycloak_subject: 'kc-target', is_active: true }] })
      .mockResolvedValueOnce({ rows: [{ status: 'conflict' }] });

    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toEqual({ ok: false, code: 'content_transfer_target_binding_conflict' });
  });

  it.each([
    ['deleted', undefined],
    ['blocked', { keycloak_subject: 'kc-target', is_active: false }],
    ['instance foreign', undefined],
  ])('rejects an %s account before resolving credentials', async (_caseName, row) => {
    state.query.mockResolvedValueOnce({ rows: row ? [row] : [] });

    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toEqual({ ok: false, code: 'content_transfer_target_invalid' });
    expect(state.readCredentials).not.toHaveBeenCalled();
  });

  it('rejects a target without usable credentials', async () => {
    state.readCredentials.mockResolvedValueOnce({ status: 'missing_credentials' });

    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toEqual({ ok: false, code: 'content_transfer_target_credentials_missing' });
  });

  it('distinguishes a missing binding from duplicate current bindings', async () => {
    state.loadBinding.mockResolvedValue(undefined);
    state.query
      .mockResolvedValueOnce({ rows: [{ keycloak_subject: 'kc-target', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toEqual({ ok: false, code: 'content_transfer_target_binding_missing' });

    state.query
      .mockResolvedValueOnce({ rows: [{ keycloak_subject: 'kc-target', is_active: true }] })
      .mockResolvedValueOnce({ rows: [{ status: 'verified' }, { status: 'verified' }] });

    await expect(
      resolveMainserverOwnershipTarget({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    ).resolves.toEqual({ ok: false, code: 'content_transfer_target_binding_conflict' });
  });

  it('resolves only the requested candidate page and filters unusable targets', async () => {
    state.loadTargets.mockResolvedValue({
      items: [
        {
          principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
          displayName: 'Aktueller Inhaber',
        },
        {
          principal: { type: 'account', id: '33333333-3333-4333-8333-333333333333' },
          displayName: 'Ohne Credentials',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 2,
    });
    state.readCredentials
      .mockResolvedValueOnce({
        status: 'ok',
        source: 'user',
        credentials: { apiKey: 'key', apiSecret: 'secret' },
        credentialFingerprint: 'a'.repeat(64),
      })
      .mockResolvedValueOnce({ status: 'missing_credentials' });

    await expect(
      listMainserverOwnershipTargets({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-actor',
        type: 'account',
        page: 1,
        pageSize: 10,
        currentOwner: {
          type: 'account',
          id: '11111111-1111-4111-8111-111111111111',
        },
        currentDataProviderId: 'provider-target',
      })
    ).resolves.toEqual({ items: [], page: 1, pageSize: 10, total: 2 });
    expect(state.loadTargets).toHaveBeenCalledTimes(1);
    expect(state.loadTargets).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        currentOwner: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
      })
    );
  });

  it('holds the target binding lock and rejects a changed binding version', async () => {
    const execute = vi.fn(async () => 'transferred');
    state.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ id: 'binding-1', last_observed_at: '2026-08-27T09:00:00.000Z' }],
    });

    await expect(
      withMainserverOwnershipTargetBindingLock({
        instanceId: 'instance-1',
        target: {
          principal: { type: 'account', id: '11111111-1111-4111-8111-111111111111' },
          dataProviderId: 'provider-target',
          bindingId: 'binding-1',
          bindingVersion: 'binding-1:2026-08-27T08:00:00.000Z',
          connection: {
            instanceId: 'instance-1',
            keycloakSubject: 'kc-target',
            actingPrincipalType: 'user',
            credentialFingerprint: 'a'.repeat(64),
          },
        },
        execute,
      })
    ).rejects.toThrow('content_transfer_target_binding_changed');
    expect(execute).not.toHaveBeenCalled();
  });
});
