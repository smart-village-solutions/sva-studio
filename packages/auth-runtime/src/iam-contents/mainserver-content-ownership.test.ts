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
  resolveMainserverOwnershipTarget,
} from './mainserver-content-ownership.js';

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

  it('filters unresolved targets and the current provider from a paginated result', async () => {
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
        currentDataProviderId: 'provider-target',
      })
    ).resolves.toEqual({ items: [], page: 1, pageSize: 10, total: 2 });
  });
});
