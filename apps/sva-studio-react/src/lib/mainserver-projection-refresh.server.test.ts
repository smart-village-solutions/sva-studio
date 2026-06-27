import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveActorAccountId: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  refreshProjectedContentsForMainserverMutation: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  resolveActorAccountId: state.resolveActorAccountId,
  withAuthenticatedUser: state.withAuthenticatedUser,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('./iam-content-list-projection.server', () => ({
  refreshProjectedContentsForMainserverMutation:
    state.refreshProjectedContentsForMainserverMutation,
}));

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server';

describe('mainserver projection refresh', () => {
  beforeEach(() => {
    state.resolveActorAccountId.mockReset();
    state.withAuthenticatedUser.mockReset();
    state.withInstanceScopedDb.mockReset();
    state.refreshProjectedContentsForMainserverMutation.mockReset();
    state.resolveActorAccountId.mockResolvedValue('account-1');
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) => work({}));
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-user-1',
          instanceId: 'de-musterhausen',
        },
      })
    );
  });

  it('refreshes the projection after successful mutating mainserver responses', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'POST' }),
      new Response('{}', { status: 200 }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      contentType: 'news.article',
      organizationId: 'org-1',
    });
  });

  it('skips projection refresh for read-only requests and failed responses', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'GET' }),
      new Response('{}', { status: 200 }),
      'news.article'
    );
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'POST' }),
      new Response('{}', { status: 503 }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
  });
});
