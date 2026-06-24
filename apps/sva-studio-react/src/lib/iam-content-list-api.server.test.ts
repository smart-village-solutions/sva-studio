import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  listContentsHandler: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
}));

vi.mock('@sva/auth-runtime/runtime-routes', () => ({
  listContentsHandler: state.listContentsHandler,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  listSvaMainserverNews: state.listSvaMainserverNews,
  listSvaMainserverEvents: state.listSvaMainserverEvents,
  listSvaMainserverPoi: state.listSvaMainserverPoi,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: state.getWorkspaceContext,
}));

import { dispatchAggregatedContentListRequest } from './iam-content-list-api.server';

describe('aggregated content list api', () => {
  beforeEach(() => {
    state.withAuthenticatedUser.mockReset();
    state.authorizeContentPrimitiveForUser.mockReset();
    state.listContentsHandler.mockReset();
    state.listSvaMainserverNews.mockReset();
    state.listSvaMainserverEvents.mockReset();
    state.listSvaMainserverPoi.mockReset();
    state.getWorkspaceContext.mockReset();
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        activeOrganizationId: 'org-1',
        user: {
          id: 'kc-user-1',
          instanceId: 'de-musterhausen',
        },
      })
    );
  });

  it('aggregates mainserver-backed content types behind GET /api/v1/iam/contents', async () => {
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [
          { action: 'news.read', resourceType: 'news' },
          { action: 'news.create' },
          { action: 'news.update' },
          { action: 'events.read' },
          { action: 'poi.read' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [],
      });

    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    state.listSvaMainserverEvents.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Sommerfest',
          contentType: 'events.event-record',
          status: 'published',
          createdAt: '2026-06-19T10:00:00.000Z',
          updatedAt: '2026-06-22T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    state.listSvaMainserverPoi.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&sortBy=updatedAt&sortDirection=desc&visibleType=news.article&visibleType=events.event-record'
      )
    );

    const payload = (await response?.json()) as {
      data: Array<{ id: string; access?: { state: string } }>;
      pagination: { total: number };
      requestId?: string;
    };

    expect(payload.data.map((item) => item.id)).toEqual(['event-1', 'news-1']);
    expect(payload.data[1]?.access?.state).toBe('editable');
    expect(payload.pagination.total).toBe(2);
    expect(payload.requestId).toBe('req-1');
    expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      activeOrganizationId: 'org-1',
      page: 1,
      pageSize: 100,
    });
    expect(state.listContentsHandler).not.toHaveBeenCalled();
  });

  it('returns an empty list for non-published mainserver status filters', async () => {
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action: 'content.read' }],
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&status=archived&visibleType=news.article'
      )
    );

    const payload = (await response?.json()) as { data: unknown[]; pagination: { total: number } };
    expect(payload.data).toEqual([]);
    expect(payload.pagination.total).toBe(0);
    expect(state.listSvaMainserverNews).not.toHaveBeenCalled();
  });

  it('merges local IAM content and mainserver content into one paginated list', async () => {
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [
          { action: 'news.read', resourceType: 'news' },
          { action: 'news.update' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [
          { action: 'content.read', resourceType: 'content' },
          { action: 'news.read', resourceType: 'news' },
          { action: 'news.update', resourceType: 'news' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [],
      });

    state.listContentsHandler.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'local-1',
              instanceId: 'de-musterhausen',
              contentType: 'legal.text',
              title: 'Datenschutz',
              status: 'published',
              createdAt: '2026-06-20T10:00:00.000Z',
              updatedAt: '2026-06-23T10:00:00.000Z',
              access: {
                state: 'editable',
                canRead: true,
                canCreate: true,
                canUpdate: true,
                organizationIds: [],
                sourceKinds: ['direct_role'],
              },
            },
          ],
          pagination: { page: 1, pageSize: 100, total: 1 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
          contentBlocks: [],
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&sortBy=updatedAt&sortDirection=desc&visibleType=legal.text&visibleType=news.article'
      )
    );

    const payload = (await response?.json()) as {
      data: Array<{ id: string }>;
      pagination: { total: number };
    };

    expect(payload.data.map((item) => item.id)).toEqual(['local-1', 'news-1']);
    expect(payload.pagination.total).toBe(2);
    expect(state.listContentsHandler).toHaveBeenCalledTimes(1);
    expect(state.listContentsHandler.mock.calls[0]?.[0]).toBeInstanceOf(Request);
    expect(new URL(String(state.listContentsHandler.mock.calls[0]?.[0]?.url)).searchParams.getAll('visibleType')).toEqual([
      'legal.text',
    ]);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
  });

  it('returns a deterministic list error when a mainserver source fails', async () => {
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action: 'content.read' }],
    });
    state.listSvaMainserverNews.mockRejectedValue(Object.assign(new Error('upstream down'), { code: 'database_unavailable' }));

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Inhalte konnten nicht geladen werden.',
      },
      requestId: 'req-1',
    });
  });

  it('falls back to the auth runtime list handler for unsupported visible types', async () => {
    const fallback = new Response(JSON.stringify({ data: [], pagination: { page: 1, pageSize: 25, total: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    state.listContentsHandler.mockResolvedValue(fallback);

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=legal.text')
    );

    expect(response).toBe(fallback);
    expect(state.listContentsHandler).toHaveBeenCalledTimes(1);
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('clamps oversized page sizes to the documented maximum', async () => {
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action: 'content.read' }],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=999&visibleType=news.article')
    );

    const payload = (await response?.json()) as { pagination: { pageSize: number } };
    expect(payload.pagination.pageSize).toBe(100);
  });

  it('stops scanning when a mainserver source reports hasNextPage without advancing data', async () => {
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'kc-user-1',
        },
        permissions: [{ action: 'content.read' }],
      });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, hasNextPage: true },
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );

    const payload = (await response?.json()) as { data: unknown[]; pagination: { total: number } };
    expect(payload.data).toEqual([]);
    expect(payload.pagination.total).toBe(0);
    expect(state.listSvaMainserverNews).toHaveBeenCalledTimes(1);
  });

  it('accepts plugin-specific mainserver read permissions without requiring content.read', async () => {
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action: 'news.read', resourceType: 'news' }],
    });
    state.listSvaMainserverNews.mockResolvedValue({
      data: [
        {
          id: 'news-1',
          title: 'Rathaus',
          contentType: 'news.article',
          payload: { teaser: 'A' },
          status: 'published',
          author: 'Redaktion',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
          publishedAt: '2026-06-21T09:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, hasNextPage: false },
    });
    state.authorizeContentPrimitiveForUser.mockResolvedValueOnce({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      permissions: [{ action: 'news.read', resourceType: 'news' }],
    });

    const response = await dispatchAggregatedContentListRequest(
      new Request('https://studio.test/api/v1/iam/contents?page=1&pageSize=25&visibleType=news.article')
    );

    const payload = (await response?.json()) as { data: Array<{ id: string }>; pagination: { total: number } };
    expect(payload.data.map((item) => item.id)).toEqual(['news-1']);
    expect(payload.pagination.total).toBe(1);
  });
});
