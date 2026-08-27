import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  annotateJournal: vi.fn(),
  listTargets: vi.fn(),
  resolveActorInfo: vi.fn(),
  resolveSource: vi.fn(),
  resolveTarget: vi.fn(),
  validateCsrf: vi.fn(),
  withLock: vi.fn(),
  withTargetLock: vi.fn(),
  authorize: vi.fn(),
  finalize: vi.fn(),
  resolveMutationActor: vi.fn(),
  resolveResourceAccess: vi.fn(),
  getNews: vi.fn(),
  getEvent: vi.fn(),
  getPoi: vi.fn(),
  getGenericItem: vi.fn(),
  transfer: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/auth-runtime/server')>()),
  annotateMainserverMutationJournal: state.annotateJournal,
  listMainserverOwnershipTargets: state.listTargets,
  resolveActorInfo: state.resolveActorInfo,
  resolveMainserverOwnershipSource: state.resolveSource,
  resolveMainserverOwnershipTarget: state.resolveTarget,
  validateCsrf: state.validateCsrf,
  withAuthenticatedUser: vi.fn(async (request: Request, callback: (ctx: unknown) => unknown) =>
    callback({
      user: { id: 'kc-actor', instanceId: 'instance-1', displayName: 'Actor' },
      activeOrganizationId: undefined,
      request,
    })
  ),
  withMainserverContentOwnershipLock: state.withLock,
  withMainserverOwnershipTargetBindingLock: state.withTargetLock,
}));
vi.mock('./mutation-principal.js', () => ({
  authorizeMainserverExistingContent: state.authorize,
  finalizeMainserverMutation: state.finalize,
  resolveMainserverMutationActor: state.resolveMutationActor,
  resolveMainserverResourceAccess: state.resolveResourceAccess,
}));
vi.mock('./service.js', () => ({
  getSvaMainserverNews: state.getNews,
  getSvaMainserverEvent: state.getEvent,
  getSvaMainserverPoi: state.getPoi,
  getSvaMainserverGenericItem: state.getGenericItem,
  transferSvaMainserverContentOwnership: state.transfer,
}));

import { dispatchSvaMainserverContentOwnershipRequest } from './content-ownership-route.js';

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'kc-actor',
  actorAccountId: '11111111-1111-4111-8111-111111111111',
  actingPrincipalType: 'user',
  credentialFingerprint: 'a'.repeat(64),
  operationExternalId: 'operation-1',
  mutationPrincipalContext: {
    version: 1,
    instanceId: 'instance-1',
    actorAccountId: '11111111-1111-4111-8111-111111111111',
    keycloakSubject: 'kc-actor',
    actingPrincipalType: 'user',
    actingPrincipalId: '11111111-1111-4111-8111-111111111111',
    credentialSource: 'user',
    credentialFingerprint: 'a'.repeat(64),
  },
};

const target = {
  principal: { type: 'organization' as const, id: '22222222-2222-4222-8222-222222222222' },
  dataProviderId: 'provider-target',
  dataProviderName: 'Zielorganisation',
  bindingId: 'binding-1',
  bindingVersion: 'binding-1:2026-08-27T09:00:00.000Z',
  connection: {
    instanceId: 'instance-1',
    keycloakSubject: 'kc-actor',
    activeOrganizationId: '22222222-2222-4222-8222-222222222222',
    actingPrincipalType: 'organization' as const,
    credentialFingerprint: 'b'.repeat(64),
  },
};

describe('Mainserver content ownership route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveActorInfo.mockResolvedValue({ actor: { instanceId: 'instance-1' } });
    state.resolveMutationActor.mockResolvedValue(actor);
    state.resolveSource.mockResolvedValue({
      principal: {
        type: 'account',
        id: '11111111-1111-4111-8111-111111111111',
      },
      dataProviderId: 'provider-source',
      dataProviderName: 'Quelle',
    });
    state.resolveResourceAccess.mockResolvedValue({ 'content.transferOwnership': true });
    state.authorize.mockResolvedValue({ authorizationMode: 'exact' });
    state.getNews.mockResolvedValue({
      id: 'news-1',
      title: 'News',
      dataProvider: { id: 'provider-source', name: 'Quelle' },
    });
    state.listTargets.mockResolvedValue({
      items: [{ principal: target.principal, displayName: 'Zielorganisation' }],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    state.resolveTarget.mockResolvedValue({ ok: true, target });
    state.validateCsrf.mockReturnValue(null);
    state.withLock.mockImplementation(async ({ execute }: { execute: () => Promise<unknown> }) =>
      execute()
    );
    state.withTargetLock.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );
    state.transfer.mockResolvedValue({
      contentType: 'news',
      contentId: 'news-1',
      sourceDataProviderId: 'provider-source',
      targetDataProviderId: 'provider-target',
    });
    state.finalize.mockResolvedValue(undefined);
  });

  it('returns null for unrelated requests and rejects unsupported methods', async () => {
    await expect(
      dispatchSvaMainserverContentOwnershipRequest(
        new Request('https://studio.test/api/v1/mainserver/news')
      )
    ).resolves.toBeNull();

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets',
        { method: 'POST' }
      )
    );
    expect(response?.status).toBe(405);
  });

  it('lists only server-validated targets after source authorization', async () => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets?type=organization&page=1&pageSize=10'
      )
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      data: [{ displayName: 'Zielorganisation' }],
      pagination: { total: 1 },
      currentOwner: {
        principal: { type: 'account' },
        displayName: 'Quelle',
      },
    });
    expect(state.resolveResourceAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: ['content.transferOwnership'],
        contentId: 'news-1',
      })
    );
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.listTargets).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'organization', currentDataProviderId: 'provider-source' })
    );
  });

  it('checks transfer authorization without resolving a target page', async () => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/authorization'
      )
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      data: { canTransfer: true },
      currentOwner: { displayName: 'Quelle' },
    });
    expect(state.listTargets).not.toHaveBeenCalled();
  });

  it('resolves the target server-side and confirms the provider before success', async () => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-sva-mainserver-entity-id')).toBe('news-1');
    expect(state.transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSourceDataProviderId: 'provider-source',
        targetDataProviderId: 'provider-target',
      })
    );
    expect(state.annotateJournal).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      operationExternalId: 'operation-1',
      expectedDataProviderId: 'provider-target',
      metadata: expect.objectContaining({
        coverage: 'studio_mutations',
        sourcePrincipalType: 'account',
        targetPrincipalType: 'organization',
        sourceDataProviderId: 'provider-source',
        targetDataProviderId: 'provider-target',
        targetBindingVersion: target.bindingVersion,
      }),
    });
    expect(state.annotateJournal.mock.invocationCallOrder[0]).toBeLessThan(
      state.transfer.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(state.withTargetLock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ bindingVersion: target.bindingVersion }),
      })
    );
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'succeeded',
        observedDataProviderId: 'provider-target',
        ownershipTransfer: expect.objectContaining({ coverage: 'studio_mutations' }),
      })
    );
  });

  it('fails closed for unsupported surveys without resolving a mutation actor', async () => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/surveys.survey/survey-1/targets'
      )
    );
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_type_unsupported',
    });
    expect(state.resolveMutationActor).not.toHaveBeenCalled();
  });

  it('marks an ambiguous provider outcome for reconciliation', async () => {
    state.transfer.mockRejectedValue(new Error('network'));
    state.getNews
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockRejectedValueOnce(new Error('target unavailable'))
      .mockRejectedValueOnce(new Error('source unavailable'));

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_reconciliation_required',
    });
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOutcome: 'unknown',
        reconciliationStatus: 'reconciliation_required',
      })
    );
  });
});
