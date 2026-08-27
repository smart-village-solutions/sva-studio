import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatch: vi.fn(),
  readFollowUp: vi.fn(),
  refreshProjection: vi.fn(),
  resolveTarget: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
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
            targetDataProvider: { name: 'Zielorganisation' },
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
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    state.refreshProjection.mockRejectedValueOnce(new Error('projection down'));

    const response = await dispatchMainserverContentOwnershipRequest(
      new Request(
        'https://studio.test/api/v1/mainserver/content-ownership/news.article/news-1/transfer',
        { method: 'POST' }
      )
    );

    expect(response?.status).toBe(200);
  });
});
