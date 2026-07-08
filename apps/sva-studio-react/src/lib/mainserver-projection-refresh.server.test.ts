import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveActorAccountId: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  refreshProjectedContentsForMainserverMutation: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  resolveActorAccountId: state.resolveActorAccountId,
  withAuthenticatedUser: state.withAuthenticatedUser,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    warn: state.loggerWarn,
  }),
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
    state.loggerWarn.mockReset();
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
      new Response(JSON.stringify({ data: { id: 'news-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      contentType: 'news.article',
      organizationId: 'org-1',
      operation: 'create',
      entityId: 'news-1',
    });
  });

  it('accepts generic item projection refreshes', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/generic-items', { method: 'POST' }),
      new Response(JSON.stringify({ data: { id: 'generic-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'generic-items.generic-item'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      contentType: 'generic-items.generic-item',
      organizationId: 'org-1',
      operation: 'create',
      entityId: 'generic-1',
    });
  });

  it('derives delete refresh identity from the request path', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/events/event-9', { method: 'DELETE' }),
      new Response(JSON.stringify({ data: { id: 'event-9' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'events.event-record'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      contentType: 'events.event-record',
      organizationId: 'org-1',
      operation: 'delete',
      entityId: 'event-9',
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

  it('keeps the mutation fachlich successful when actor account resolution fails', async () => {
    state.resolveActorAccountId.mockRejectedValue(new Error('db down'));

    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/poi', { method: 'POST' }),
        new Response(JSON.stringify({ data: { id: 'poi-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        'poi.point-of-interest'
      )
    ).resolves.toBeUndefined();

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
    expect(state.loggerWarn).toHaveBeenCalledTimes(1);
  });
});
