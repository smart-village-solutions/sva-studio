import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatch: vi.fn(),
  finalizeJournal: vi.fn(),
  loadRecoverableTransfers: vi.fn(),
  markReconciliationRequired: vi.fn(),
  readFollowUp: vi.fn(),
  refreshProjection: vi.fn(),
  resolveTarget: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  finalizeMainserverMutationJournal: state.finalizeJournal,
  loadRecoverableMainserverOwnershipTransfers: state.loadRecoverableTransfers,
  markMainserverMutationReconciliationRequired: state.markReconciliationRequired,
  resolveMainserverOwnershipTarget: state.resolveTarget,
}));
vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverContentOwnershipRequest: state.dispatch,
  readMainserverMutationFollowUpContext: state.readFollowUp,
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn() }),
}));
vi.mock('./iam-content-list-projection.server.js', () => ({
  refreshProjectedContentsForMainserverMutation: state.refreshProjection,
}));
vi.mock('./mainserver-projection-refresh.server.js', () => ({
  refreshProjectionAfterMainserverMutation: vi.fn(),
}));

import { dispatchMainserverContentOwnershipRequest } from './mainserver-content-ownership-api.server.js';

describe('mainserver content ownership API projection follow-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.finalizeJournal.mockResolvedValue(undefined);
    state.loadRecoverableTransfers.mockResolvedValue([]);
    state.markReconciliationRequired.mockResolvedValue(undefined);
    state.readFollowUp.mockReturnValue({
      instanceId: 'instance-1',
      keycloakSubject: 'kc-actor',
      actorAccountId: '11111111-1111-4111-8111-111111111111',
      actorDisplayName: 'Ausführende Person',
      operationExternalId: 'operation-1',
    });
    state.resolveTarget.mockResolvedValue({
      ok: true,
      target: {
        dataProviderId: 'provider-target',
        dataProviderName: 'Zielorganisation',
        connection: {
          keycloakSubject: 'kc-actor',
          actingPrincipalType: 'organization',
          credentialFingerprint: 'a'.repeat(64),
        },
      },
    });
  });

  it('refreshes the confirmed entity with target credentials without changing provider success', async () => {
    state.dispatch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            contentId: 'news-1',
            targetPrincipal: {
              type: 'organization',
              id: '22222222-2222-4222-8222-222222222222',
            },
            targetDataProvider: { id: 'provider-target', name: 'Zielorganisation' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(response?.status).toBe(200);
    expect(state.refreshProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'news.article',
        entityId: 'news-1',
        organizationId: '22222222-2222-4222-8222-222222222222',
        actorAccountId: '11111111-1111-4111-8111-111111111111',
        actorDisplayName: 'Ausführende Person',
        ownershipPrincipal: {
          type: 'organization',
          id: '22222222-2222-4222-8222-222222222222',
        },
        actingPrincipalType: 'organization',
        credentialFingerprint: 'a'.repeat(64),
        operation: 'update',
      })
    );
    expect(state.finalizeJournal).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      operationExternalId: 'operation-1',
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps: ['target_projection_refreshed'],
      contentId: 'news-1',
    });
  });

  it('keeps the confirmed response successful when the local target projection fails', async () => {
    state.dispatch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            contentId: 'news-1',
            targetPrincipal: {
              type: 'organization',
              id: '22222222-2222-4222-8222-222222222222',
            },
            targetDataProvider: { id: 'provider-target' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    state.refreshProjection.mockRejectedValueOnce(new Error('projection down'));
    state.markReconciliationRequired.mockRejectedValueOnce(new Error('database down'));

    const response = await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(response?.status).toBe(200);
    expect(state.markReconciliationRequired).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      operationExternalId: 'operation-1',
      completedStep: 'target_projection_refresh_failed',
      lastErrorCode: 'content_transfer_projection_refresh_failed',
    });
  });

  it('writes account transfers into the recipient scope while retaining the audit actor', async () => {
    state.resolveTarget.mockResolvedValueOnce({
      ok: true,
      target: {
        dataProviderId: 'provider-target',
        connection: {
          keycloakSubject: 'kc-recipient',
          actingPrincipalType: 'user',
          credentialFingerprint: 'b'.repeat(64),
        },
      },
    });
    state.dispatch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            contentId: 'news-1',
            targetPrincipal: {
              type: 'account',
              id: '22222222-2222-4222-8222-222222222222',
            },
            targetDataProvider: { id: 'provider-target' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(state.refreshProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: '22222222-2222-4222-8222-222222222222',
        auditActorAccountId: '11111111-1111-4111-8111-111111111111',
        keycloakSubject: 'kc-recipient',
      })
    );
  });

  it('repairs a provider-confirmed projection before dispatching another transfer', async () => {
    state.loadRecoverableTransfers.mockResolvedValueOnce([
      {
        operationExternalId: 'operation-previous',
        expectedDataProviderId: 'provider-target',
        targetPrincipal: {
          type: 'organization',
          id: '22222222-2222-4222-8222-222222222222',
        },
      },
    ]);
    state.dispatch.mockImplementationOnce(async (_request, options) => {
      await options.reconcilePreviousTransfer({
        instanceId: 'instance-1',
        contentType: 'news.article',
        contentId: 'news-1',
        currentDataProviderId: 'provider-target',
      });
      return new Response(JSON.stringify({ error: 'content_transfer_target_invalid' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    });

    await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(state.loadRecoverableTransfers).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      contentType: 'news.article',
      contentId: 'news-1',
      currentDataProviderId: 'provider-target',
    });
    expect(state.refreshProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationRef: 'operation-previous',
        ownershipPrincipal: {
          type: 'organization',
          id: '22222222-2222-4222-8222-222222222222',
        },
      })
    );
    expect(state.finalizeJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        operationExternalId: 'operation-previous',
        reconciliationStatus: 'complete',
      })
    );
  });

  it('keeps reconciliation blocked when the recorded target binding has changed', async () => {
    state.loadRecoverableTransfers.mockResolvedValueOnce([
      {
        operationExternalId: 'operation-previous',
        expectedDataProviderId: 'provider-recorded',
        targetPrincipal: {
          type: 'organization',
          id: '22222222-2222-4222-8222-222222222222',
        },
      },
    ]);
    state.dispatch.mockImplementationOnce(async (_request, options) => {
      await expect(
        options.reconcilePreviousTransfer({
          instanceId: 'instance-1',
          contentType: 'news.article',
          contentId: 'news-1',
          currentDataProviderId: 'provider-recorded',
        })
      ).rejects.toThrow('content_transfer_target_binding_changed');
      return new Response(JSON.stringify({ error: 'content_transfer_reconciliation_required' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    });

    const response = await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(response?.status).toBe(409);
    expect(state.refreshProjection).not.toHaveBeenCalled();
    expect(state.finalizeJournal).not.toHaveBeenCalled();
  });
});
