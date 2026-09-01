import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  annotateJournal: vi.fn(),
  hasUnresolvedTransfer: vi.fn(),
  loadExternalContentReference: vi.fn(),
  loadIdentity: vi.fn(),
  listTargets: vi.fn(),
  recordObservation: vi.fn(),
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
  hasUnresolvedMainserverOwnershipTransfer: state.hasUnresolvedTransfer,
  listMainserverOwnershipTargets: state.listTargets,
  loadExternalContentReferenceByContentId: state.loadExternalContentReference,
  recordMainserverDataProviderObservation: state.recordObservation,
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
  loadSvaMainserverDataProviderIdentity: state.loadIdentity,
  transferSvaMainserverContentOwnership: state.transfer,
}));

import { dispatchSvaMainserverContentOwnershipRequest } from './content-ownership-route.js';
import { SvaMainserverError } from './errors.js';

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

const verificationCandidate = {
  principal: target.principal,
  connection: target.connection,
};

const sourceTarget = {
  principal: { type: 'account' as const, id: '11111111-1111-4111-8111-111111111111' },
  dataProviderId: 'provider-source',
  dataProviderName: 'Quelle',
  bindingId: 'binding-source',
  bindingVersion: 'binding-source:2026-08-27T09:00:00.000Z',
  connection: {
    instanceId: 'instance-1',
    keycloakSubject: 'kc-source',
    actingPrincipalType: 'user' as const,
    credentialFingerprint: 'c'.repeat(64),
  },
};

const useTargetResolution = (result: unknown) => {
  state.resolveTarget.mockImplementation(async ({ principal }: { principal: { id: string } }) =>
    principal.id === sourceTarget.principal.id ? { ok: true, target: sourceTarget } : result
  );
};

describe('Mainserver content ownership route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SVA_MAINSERVER_CONFIRMED_CAPABILITIES;
    state.hasUnresolvedTransfer.mockResolvedValue(false);
    state.loadExternalContentReference.mockResolvedValue(undefined);
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
    state.loadIdentity.mockResolvedValue({
      dataProvider: { id: 'provider-target', name: 'Zielorganisation' },
    });
    state.recordObservation.mockResolvedValue({ outcome: 'created' });
    useTargetResolution({ ok: true, target });
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

  it('authorizes supported ownership transfers without runtime configuration', async () => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/authorization'
      )
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      data: { canTransfer: true },
    });
    expect(state.resolveMutationActor).toHaveBeenCalled();
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
        keycloakSubject: 'kc-source',
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
        reconciliationStatus: 'reconciliation_required',
        observedDataProviderId: 'provider-target',
        ownershipTransfer: expect.objectContaining({ coverage: 'studio_mutations' }),
      })
    );
  });

  it('verifies and persists a missing target binding only after transfer confirmation', async () => {
    let targetAttempts = 0;
    state.resolveTarget.mockImplementation(async ({ principal }: { principal: { id: string } }) => {
      if (principal.id === sourceTarget.principal.id) return { ok: true, target: sourceTarget };
      targetAttempts += 1;
      return targetAttempts === 1
        ? {
            ok: false,
            code: 'content_transfer_target_binding_missing',
            verificationCandidate,
          }
        : { ok: true, target };
    });

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
    expect(state.loadIdentity).toHaveBeenCalledWith(verificationCandidate.connection);
    expect(state.recordObservation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      principalType: 'organization',
      principalId: target.principal.id,
      credentialFingerprint: target.connection.credentialFingerprint,
      dataProviderId: 'provider-target',
      dataProviderName: 'Zielorganisation',
      evidenceKind: 'identity_endpoint',
    });
    expect(state.loadIdentity.mock.invocationCallOrder[0]).toBeLessThan(
      state.recordObservation.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(state.recordObservation.mock.invocationCallOrder[0]).toBeLessThan(
      state.transfer.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it('fails without a provider write when target identity verification is unavailable', async () => {
    useTargetResolution({
      ok: false,
      code: 'content_transfer_target_binding_missing',
      verificationCandidate,
    });
    state.loadIdentity.mockRejectedValueOnce(
      new SvaMainserverError({
        code: 'network_error',
        message: 'Identity unavailable',
        statusCode: 503,
      })
    );

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_target_verification_failed',
    });
    expect(state.recordObservation).not.toHaveBeenCalled();
    expect(state.transfer).not.toHaveBeenCalled();
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        completedSteps: ['target_identity_verification_failed'],
        providerOutcome: 'failed',
        reconciliationStatus: 'complete',
      })
    );
  });

  it('preserves the stable verification error when journal finalization also fails', async () => {
    useTargetResolution({
      ok: false,
      code: 'content_transfer_target_binding_missing',
      verificationCandidate,
    });
    state.loadIdentity.mockRejectedValueOnce(new Error('Identity unavailable'));
    state.finalize.mockRejectedValueOnce(new Error('Journal unavailable'));

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_target_verification_failed',
    });
    expect(state.transfer).not.toHaveBeenCalled();
    expect(state.finalize).toHaveBeenCalledOnce();
  });

  it('rejects a conflict discovered while verifying a missing target binding', async () => {
    useTargetResolution({
      ok: false,
      code: 'content_transfer_target_binding_missing',
      verificationCandidate,
    });
    state.recordObservation.mockResolvedValueOnce({ outcome: 'conflict' });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_target_binding_conflict',
    });
    expect(state.transfer).not.toHaveBeenCalled();
  });

  it('blocks a second write while an earlier transfer needs reconciliation', async () => {
    state.hasUnresolvedTransfer.mockResolvedValueOnce(true);

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
    expect(state.transfer).not.toHaveBeenCalled();
  });

  it('keeps provider success when journal finalization fails', async () => {
    state.finalize.mockRejectedValueOnce(new Error('database unavailable'));

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
    expect(state.transfer).toHaveBeenCalledOnce();
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

  it.each([
    'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1',
    'https://studio.test/api/v1/mainserver/content-ownership/unknown/news-1/targets',
    'https://studio.test/api/v1/mainserver/content-ownership/news.article//targets',
    'https://studio.test/api/v1/mainserver/content-ownership/%E0%A4%A/news-1/targets',
  ])('ignores malformed ownership route %s', async (url) => {
    await expect(
      dispatchSvaMainserverContentOwnershipRequest(new Request(url))
    ).resolves.toBeNull();
  });

  it('rejects a transfer GET and forwards actor resolution responses', async () => {
    const wrongMethod = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer'
      )
    );
    expect(wrongMethod?.status).toBe(405);

    const actorError = new Response('actor unavailable', { status: 503 });
    state.resolveMutationActor.mockResolvedValueOnce(actorError);
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets'
      )
    );
    expect(response).toBe(actorError);
  });

  it('fails closed when source ownership or transfer access cannot be resolved', async () => {
    state.getNews.mockResolvedValueOnce({ id: 'news-1', dataProvider: null });
    let response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets'
      )
    );
    expect(response?.status).toBe(409);

    state.resolveSource.mockResolvedValueOnce(undefined);
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets'
      )
    );
    expect(response?.status).toBe(409);

    state.resolveResourceAccess.mockResolvedValueOnce({ 'content.transferOwnership': false });
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets'
      )
    );
    expect(response?.status).toBe(403);
  });

  it('normalizes target pagination, search and owner fallback values', async () => {
    state.resolveSource.mockResolvedValueOnce({
      principal: { type: 'organization', id: 'organization-source' },
      dataProviderId: 'provider-source',
    });
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets?type=account&page=-2&pageSize=200&q=%20Target%20'
      )
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      currentOwner: { displayName: 'provider-source' },
    });
    expect(state.listTargets).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50, search: 'Target' })
    );

    const invalidType = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/targets?type=service'
      )
    );
    expect(invalidType?.status).toBe(400);
  });

  it.each([
    ['events.event-record', 'event-1', 'getEvent'],
    ['poi.point-of-interest', 'poi-1', 'getPoi'],
    ['generic-items.generic-item', 'generic-1', 'getGenericItem'],
    ['faq.faq', 'faq-1', 'getGenericItem'],
    ['cockpit-cards.cockpit-card', 'card-1', 'getGenericItem'],
    ['projects.project', 'project-1', 'getGenericItem'],
  ] as const)('loads %s ownership through its Mainserver collection', async (type, id, getter) => {
    const genericType =
      type === 'faq.faq'
        ? 'FAQ'
        : type === 'cockpit-cards.cockpit-card'
          ? 'COCKPIT_CARD'
          : type === 'projects.project'
            ? 'FeaturedProject'
            : 'INFO';
    state[getter].mockResolvedValue({ id, dataProvider: { id: 'provider-source' }, genericType });
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        `https://studio.test/api/v1/mainserver/content-ownership/${type}/${id}/authorization`
      )
    );
    expect(response?.status).toBe(200);
    expect(state[getter]).toHaveBeenCalled();
  });

  it('rejects a generic item that belongs to a reserved subtype', async () => {
    state.getGenericItem.mockResolvedValueOnce({
      id: 'generic-1',
      dataProvider: { id: 'provider-source' },
      genericType: 'FAQ',
    });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/generic-items.generic-item/generic-1/authorization'
      )
    );

    expect(response?.status).toBe(404);
    expect(state.resolveResourceAccess).not.toHaveBeenCalled();
  });

  it('uses the Mainserver source id for projected projects', async () => {
    state.loadExternalContentReference.mockResolvedValueOnce({
      sourceEntityId: 'project-source-1',
    });
    state.getGenericItem.mockResolvedValueOnce({
      id: 'project-source-1',
      dataProvider: { id: 'provider-source' },
      genericType: 'FeaturedProject',
    });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/projects.project/project-local-1/authorization'
      )
    );

    expect(response?.status).toBe(200);
    expect(state.getGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({ genericItemId: 'project-source-1' })
    );
  });

  it('returns the Mainserver source id after transferring a projected project', async () => {
    state.loadExternalContentReference.mockResolvedValue({
      sourceEntityId: 'project-source-1',
    });
    state.getGenericItem.mockResolvedValue({
      id: 'project-source-1',
      dataProvider: { id: 'provider-source' },
      genericType: 'FeaturedProject',
    });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/projects.project/project-local-1/transfer',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetPrincipal: target.principal }),
        }
      )
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-sva-mainserver-entity-id')).toBe('project-source-1');
    await expect(response?.json()).resolves.toMatchObject({
      data: { contentId: 'project-source-1' },
    });
  });

  it.each([
    [null, 400],
    [{ targetPrincipal: { type: 'service', id: target.principal.id } }, 400],
    [{ targetPrincipal: { type: 'organization', id: 'not-a-uuid' } }, 400],
    [{ targetPrincipal: target.principal, extra: true }, 400],
  ])('rejects invalid transfer payload %#', async (body, status) => {
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body === null ? 'null' : JSON.stringify(body),
        }
      )
    );
    expect(response?.status).toBe(status);
  });

  it('returns csrf, authorization, source and unchanged-target transfer conflicts', async () => {
    const csrf = new Response('csrf', { status: 403 });
    state.validateCsrf.mockReturnValueOnce(csrf);
    let response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response).toBe(csrf);

    state.getNews.mockResolvedValueOnce({ id: 'news-1', dataProvider: null });
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(409);

    state.resolveSource.mockResolvedValueOnce(undefined);
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(409);

    const denied = new Response('denied', { status: 403 });
    state.authorize.mockResolvedValueOnce(denied);
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response).toBe(denied);

    useTargetResolution({
      ok: true,
      target: { ...target, dataProviderId: 'provider-source' },
    });
    response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(409);
  });

  it.each([
    ['content_transfer_target_invalid', 400],
    ['content_transfer_target_credentials_missing', 409],
    ['content_transfer_target_binding_conflict', 409],
    ['database_unavailable', 503],
  ] as const)('maps target resolution error %s', async (code, status) => {
    useTargetResolution({ ok: false, code });
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(status);
  });

  it('maps a changed target binding to a deterministic conflict', async () => {
    state.withTargetLock.mockRejectedValueOnce(
      new Error('content_transfer_target_binding_changed')
    );
    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'content_transfer_target_binding_conflict',
    });
  });

  it('accepts a transfer confirmed by the target reread after a provider error', async () => {
    state.transfer.mockRejectedValueOnce(new Error('network'));
    state.getNews
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-target' } });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(200);
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        completedSteps: ['target_reread_confirmed'],
        reconciliationStatus: 'reconciliation_required',
      })
    );
  });

  it('keeps target-reread success when journal finalization fails', async () => {
    state.transfer.mockRejectedValueOnce(new Error('network'));
    state.finalize.mockRejectedValueOnce(new Error('database unavailable'));
    state.getNews
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-target' } });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );

    expect(response?.status).toBe(200);
  });

  it('returns the provider error when the source reread confirms no transfer', async () => {
    state.transfer.mockRejectedValueOnce(
      new SvaMainserverError({ code: 'graphql_error', message: 'rejected', statusCode: 502 })
    );
    state.getNews
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'other-provider' } })
      .mockResolvedValueOnce({ id: 'news-1', dataProvider: { id: 'provider-source' } });

    const response = await dispatchSvaMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST', body: JSON.stringify({ targetPrincipal: target.principal }) }
      )
    );
    expect(response?.status).toBe(502);
    expect(state.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ completedSteps: ['source_reread_confirmed'] })
    );
  });
});
