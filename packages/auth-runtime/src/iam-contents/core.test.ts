import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IamContentAccessSummary, IamContentListItem } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

const {
  authorizeContentActionMock,
  createContentResponseMock,
  deleteContentResponseMock,
  loadContentByIdMock,
  loadContentDetailMock,
  loadContentHistoryMock,
  loadContentListItemsMock,
  loadContentListScopesMock,
  resolveContentAccessMock,
  resolveContentActorMock,
  updateContentResponseMock,
  withAuthenticatedContentHandlerMock,
} = vi.hoisted(() => ({
  authorizeContentActionMock: vi.fn(),
  createContentResponseMock: vi.fn(),
  deleteContentResponseMock: vi.fn(),
  loadContentByIdMock: vi.fn(),
  loadContentDetailMock: vi.fn(),
  loadContentHistoryMock: vi.fn(),
  loadContentListItemsMock: vi.fn(),
  loadContentListScopesMock: vi.fn(),
  resolveContentAccessMock: vi.fn(),
  resolveContentActorMock: vi.fn(),
  updateContentResponseMock: vi.fn(),
  withAuthenticatedContentHandlerMock: vi.fn(),
}));

vi.mock('./request-context.js', () => ({
  authorizeContentAction: authorizeContentActionMock,
  resolveContentAccess: resolveContentAccessMock,
  resolveContentActor: resolveContentActorMock,
  withAuthenticatedContentHandler: withAuthenticatedContentHandlerMock,
}));

vi.mock('./repository.js', () => ({
  loadContentById: loadContentByIdMock,
  loadContentDetail: loadContentDetailMock,
  loadContentHistory: loadContentHistoryMock,
  loadContentListItems: loadContentListItemsMock,
  loadContentListScopes: loadContentListScopesMock,
}));

vi.mock('./mutations.js', () => ({
  createContentResponse: createContentResponseMock,
  deleteContentResponse: deleteContentResponseMock,
  updateContentResponse: updateContentResponseMock,
}));

const {
  createContentHandler,
  createContentInternal,
  deleteContentHandler,
  deleteContentInternal,
  getContentHandler,
  getContentHistoryHandler,
  getContentHistoryInternal,
  getContentInternal,
  listContentsHandler,
  listContentsInternal,
  updateContentHandler,
  updateContentInternal,
} = await import('./core.js');

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorAccountId: 'account-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
  traceId: 'trace-1',
};

const access = {
  state: 'allowed',
  canRead: true,
  canCreate: true,
  canUpdate: true,
  organizationIds: [],
  sourceKinds: [],
} satisfies IamContentAccessSummary;

const item = (id: string, organizationId: string): IamContentListItem => ({
  id,
  instanceId: 'instance-1',
  contentType: 'news.article',
  organizationId,
  title: `Content ${id}`,
  createdAt: '2026-04-26T10:00:00.000Z',
  createdBy: 'creator-1',
  updatedAt: '2026-04-26T10:00:00.000Z',
  updatedBy: 'updater-1',
  author: 'Actor',
  payload: {},
  status: 'draft',
  validationState: 'valid',
  historyRef: `history-${id}`,
});

const readJson = async (response: Response) => response.json() as Promise<Record<string, unknown>>;
const ctx = { sessionId: 'session-1', user: { sub: 'subject-1' } } as unknown as AuthenticatedRequestContext;

describe('content core authorization', () => {
  beforeEach(() => {
    authorizeContentActionMock.mockReset();
    createContentResponseMock.mockReset();
    deleteContentResponseMock.mockReset();
    loadContentByIdMock.mockReset();
    loadContentDetailMock.mockReset();
    loadContentHistoryMock.mockReset();
    loadContentListItemsMock.mockReset();
    loadContentListScopesMock.mockReset();
    resolveContentAccessMock.mockReset();
    resolveContentActorMock.mockReset();
    updateContentResponseMock.mockReset();
    withAuthenticatedContentHandlerMock.mockReset();

    resolveContentActorMock.mockResolvedValue({ actor });
    resolveContentAccessMock.mockResolvedValue(access);
    loadContentListScopesMock.mockResolvedValue([]);
  });

  it('filters list responses per item using the persisted organization context', async () => {
    const visible = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentListScopesMock.mockResolvedValue([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    loadContentListItemsMock.mockResolvedValue({
      items: [visible],
      total: 1,
    });
    authorizeContentActionMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(200);
    expect(loadContentListScopesMock).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        page: 1,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      })
    );
    expect(loadContentListItemsMock).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        page: 1,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }),
      {
        allowedOrganizationIds: ['11111111-1111-4111-8111-111111111111'],
        includeUnscopedContent: false,
      }
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.read',
      expect.objectContaining({
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'content.read',
      expect.objectContaining({
        organizationId: '22222222-2222-4222-8222-222222222222',
      })
    );
    expect(await readJson(response)).toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: expect.objectContaining({ total: 1 }),
    });
  });

  it('passes the actor account id into list scope prechecks for own-scoped permissions', async () => {
    loadContentListScopesMock.mockResolvedValue(['11111111-1111-4111-8111-111111111111']);
    loadContentListItemsMock.mockResolvedValue({
      items: [item('content-1', '11111111-1111-4111-8111-111111111111')],
      total: 1,
    });
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'content.read',
      expect.objectContaining({
        organizationId: '11111111-1111-4111-8111-111111111111',
        createdByAccountId: 'account-1',
      })
    );
  });

  it('forwards query filters and paginates after authorization', async () => {
    loadContentListScopesMock.mockResolvedValue(['11111111-1111-4111-8111-111111111111']);
    loadContentListItemsMock.mockResolvedValue({
      items: [item('content-2', '11111111-1111-4111-8111-111111111111')],
      total: 3,
    });
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await listContentsInternal(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=2&pageSize=1&q=rathaus&type=poi.point-of-interest&status=published&sortBy=title&sortDirection=asc&visibleType=poi.point-of-interest&visibleType=news.article'
      ),
      ctx
    );

    expect(loadContentListScopesMock).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        page: 2,
        pageSize: 1,
        q: 'rathaus',
        type: 'poi.point-of-interest',
        status: 'published',
        sortBy: 'title',
        sortDirection: 'asc',
        visibleTypes: ['poi.point-of-interest', 'news.article'],
      })
    );
    expect(loadContentListItemsMock).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({
        page: 2,
        pageSize: 1,
        q: 'rathaus',
        type: 'poi.point-of-interest',
        status: 'published',
        sortBy: 'title',
        sortDirection: 'asc',
        visibleTypes: ['poi.point-of-interest', 'news.article'],
      }),
      {
        allowedOrganizationIds: ['11111111-1111-4111-8111-111111111111'],
        includeUnscopedContent: false,
      }
    );
    await expect(readJson(response)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-2' })],
      pagination: {
        page: 2,
        pageSize: 1,
        total: 3,
      },
    });
  });

  it('filters list items that fail item-specific read authorization', async () => {
    const allowedItem = item('content-1', '11111111-1111-4111-8111-111111111111');
    const deniedItem = item('content-2', '11111111-1111-4111-8111-111111111111');
    deniedItem.contentType = 'poi.point-of-interest';

    loadContentListScopesMock.mockResolvedValue(['11111111-1111-4111-8111-111111111111']);
    loadContentListItemsMock.mockResolvedValue({
      items: [allowedItem, deniedItem],
      total: 2,
    });
    authorizeContentActionMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'content-1' })],
      pagination: expect.objectContaining({ total: 1 }),
    });
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'news.read',
      expect.objectContaining({
        contentId: 'content-1',
        contentType: 'news.article',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      3,
      actor,
      'poi.read',
      expect.objectContaining({
        contentId: 'content-2',
        contentType: 'poi.point-of-interest',
      })
    );
  });

  it('returns server authorization errors from list reads even when other items are readable', async () => {
    loadContentListScopesMock.mockResolvedValue([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    authorizeContentActionMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(503);
  });

  it('returns actor resolution errors before listing contents', async () => {
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(401);
    expect(loadContentListItemsMock).not.toHaveBeenCalled();
  });

  it('returns a database error when listing contents fails', async () => {
    loadContentListItemsMock.mockRejectedValue(new Error('db_down'));

    const response = await listContentsInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toMatchObject({
      error: expect.objectContaining({ code: 'database_unavailable' }),
    });
  });

  it('loads content metadata before authorizing detail reads', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentDetailMock.mockResolvedValue({ ...content, history: [] });
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenCalledWith(
      actor,
      'news.read',
      expect.objectContaining({
        contentId: 'content-1',
        contentType: 'news.article',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(loadContentDetailMock).toHaveBeenCalledWith('instance-1', 'content-1');
  });

  it('returns actor resolution errors before loading content details', async () => {
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(401);
    expect(loadContentByIdMock).not.toHaveBeenCalled();
  });

  it('rejects detail reads without a content id', async () => {
    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({
      error: expect.objectContaining({ code: 'invalid_request' }),
    });
  });

  it('returns not found when content metadata is missing for detail reads', async () => {
    loadContentByIdMock.mockResolvedValue(undefined);

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(404);
  });

  it('returns authorization errors from detail reads', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    authorizeContentActionMock.mockResolvedValue(new Response(null, { status: 403 }));

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(403);
    expect(loadContentDetailMock).not.toHaveBeenCalled();
  });

  it('uses plugin-specific read actions for scope prechecks and list items', async () => {
    const poiItem = item('content-2', '11111111-1111-4111-8111-111111111111');
    poiItem.contentType = 'poi.point-of-interest';

    loadContentListScopesMock.mockResolvedValue(['11111111-1111-4111-8111-111111111111']);
    loadContentListItemsMock.mockResolvedValue({
      items: [poiItem],
      total: 1,
    });
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await listContentsInternal(
      new Request(
        'https://studio.test/api/v1/iam/contents?page=1&pageSize=25&type=poi.point-of-interest&visibleType=poi.point-of-interest'
      ),
      ctx
    );

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      1,
      actor,
      'poi.read',
      expect.objectContaining({
        organizationId: '11111111-1111-4111-8111-111111111111',
        createdByAccountId: 'account-1',
      })
    );
    expect(authorizeContentActionMock).toHaveBeenNthCalledWith(
      2,
      actor,
      'poi.read',
      expect.objectContaining({
        contentId: 'content-2',
        contentType: 'poi.point-of-interest',
      })
    );
  });

  it('returns not found when detail data disappears after authorization', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentDetailMock.mockResolvedValue(undefined);
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(404);
  });

  it('returns a database error when loading content details fails', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentDetailMock.mockRejectedValue(new Error('db_down'));
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentInternal(new Request('https://studio.test/api/v1/iam/contents/content-1'), ctx);

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toMatchObject({
      error: expect.objectContaining({ code: 'database_unavailable' }),
    });
  });

  it('loads content history after explicit history authorization', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentHistoryMock.mockResolvedValue([
      {
        id: 'history-1',
        contentId: 'content-1',
        action: 'updated',
        actorDisplayName: 'Actor',
        changedFields: ['title'],
        createdAt: '2026-04-26T10:00:00.000Z',
        summary: 'Titel angepasst',
      },
    ]);
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentHistoryInternal(
      new Request('https://studio.test/api/v1/iam/contents/content-1/history'),
      ctx
    );

    expect(response.status).toBe(200);
    expect(authorizeContentActionMock).toHaveBeenCalledWith(
      actor,
      'content.readHistory',
      expect.objectContaining({
        contentId: 'content-1',
        contentType: 'news.article',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    await expect(readJson(response)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'history-1' })],
      pagination: expect.objectContaining({ total: 1 }),
    });
  });

  it('returns actor resolution errors before loading content history', async () => {
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await getContentHistoryInternal(
      new Request('https://studio.test/api/v1/iam/contents/content-1/history'),
      ctx
    );

    expect(response.status).toBe(401);
    expect(loadContentByIdMock).not.toHaveBeenCalled();
  });

  it('rejects history reads without a content id', async () => {
    const response = await getContentHistoryInternal(new Request('https://studio.test/api/v1/iam/contents'), ctx);

    expect(response.status).toBe(400);
  });

  it('returns not found when content history metadata is missing', async () => {
    loadContentByIdMock.mockResolvedValue(undefined);

    const response = await getContentHistoryInternal(
      new Request('https://studio.test/api/v1/iam/contents/content-1/history'),
      ctx
    );

    expect(response.status).toBe(404);
  });

  it('returns authorization errors from history reads', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    authorizeContentActionMock.mockResolvedValue(new Response(null, { status: 403 }));

    const response = await getContentHistoryInternal(
      new Request('https://studio.test/api/v1/iam/contents/content-1/history'),
      ctx
    );

    expect(response.status).toBe(403);
    expect(loadContentHistoryMock).not.toHaveBeenCalled();
  });

  it('returns a database error when loading content history fails', async () => {
    const content = item('content-1', '11111111-1111-4111-8111-111111111111');
    loadContentByIdMock.mockResolvedValue(content);
    loadContentHistoryMock.mockRejectedValue(new Error('db_down'));
    authorizeContentActionMock.mockResolvedValue(null);

    const response = await getContentHistoryInternal(
      new Request('https://studio.test/api/v1/iam/contents/content-1/history'),
      ctx
    );

    expect(response.status).toBe(503);
    await expect(readJson(response)).resolves.toMatchObject({
      error: expect.objectContaining({ code: 'database_unavailable' }),
    });
  });

  it('delegates content creation after resolving an actor account id', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents', { method: 'POST' });
    const expected = new Response(null, { status: 201 });
    createContentResponseMock.mockResolvedValue(expected);

    const response = await createContentInternal(request, ctx);

    expect(response).toBe(expected);
    expect(resolveContentActorMock).toHaveBeenCalledWith(request, ctx, { requireActorAccountId: true });
    expect(createContentResponseMock).toHaveBeenCalledWith(request, actor);
  });

  it('returns actor resolution errors before delegating content creation', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents', { method: 'POST' });
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await createContentInternal(request, ctx);

    expect(response.status).toBe(401);
    expect(createContentResponseMock).not.toHaveBeenCalled();
  });

  it('delegates content updates after resolving an actor account id', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents/content-1', { method: 'PATCH' });
    const expected = new Response(null, { status: 200 });
    updateContentResponseMock.mockResolvedValue(expected);

    const response = await updateContentInternal(request, ctx);

    expect(response).toBe(expected);
    expect(resolveContentActorMock).toHaveBeenCalledWith(request, ctx, { requireActorAccountId: true });
    expect(updateContentResponseMock).toHaveBeenCalledWith(request, actor);
  });

  it('returns actor resolution errors before delegating content updates', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents/content-1', { method: 'PATCH' });
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await updateContentInternal(request, ctx);

    expect(response.status).toBe(401);
    expect(updateContentResponseMock).not.toHaveBeenCalled();
  });

  it('delegates content deletion after resolving an actor account id', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents/content-1', { method: 'DELETE' });
    const expected = new Response(null, { status: 200 });
    deleteContentResponseMock.mockResolvedValue(expected);

    const response = await deleteContentInternal(request, ctx);

    expect(response).toBe(expected);
    expect(resolveContentActorMock).toHaveBeenCalledWith(request, ctx, { requireActorAccountId: true });
    expect(deleteContentResponseMock).toHaveBeenCalledWith(request, actor);
  });

  it('returns actor resolution errors before delegating content deletion', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents/content-1', { method: 'DELETE' });
    resolveContentActorMock.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    const response = await deleteContentInternal(request, ctx);

    expect(response.status).toBe(401);
    expect(deleteContentResponseMock).not.toHaveBeenCalled();
  });

  it('delegates every public handler to the authenticated content wrapper', async () => {
    const request = new Request('https://studio.test/api/v1/iam/contents/content-1');
    const expected = new Response(null, { status: 204 });
    withAuthenticatedContentHandlerMock.mockResolvedValue(expected);

    expect(await listContentsHandler(request)).toBe(expected);
    expect(await getContentHandler(request)).toBe(expected);
    expect(await getContentHistoryHandler(request)).toBe(expected);
    expect(await createContentHandler(request)).toBe(expected);
    expect(await updateContentHandler(request)).toBe(expected);
    expect(await deleteContentHandler(request)).toBe(expected);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(1, request, listContentsInternal);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(2, request, getContentInternal);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(3, request, getContentHistoryInternal);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(4, request, createContentInternal);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(5, request, updateContentInternal);
    expect(withAuthenticatedContentHandlerMock).toHaveBeenNthCalledWith(6, request, deleteContentInternal);
  });
});
