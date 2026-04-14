import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: { error: vi.fn() },
  readPathSegment: vi.fn(),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  asApiList: vi.fn((data: unknown, pagination: unknown, requestId?: string) => ({ data, pagination, ...(requestId ? { requestId } : {}) })),
  asApiItem: vi.fn((data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) })),
  resolveContentActor: vi.fn(),
  withAuthenticatedContentHandler: vi.fn(async (request: Request, handler: (request: Request, ctx: unknown) => Promise<Response>) =>
    handler(request, {
      user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
      sessionId: 'session-1',
    })
  ),
  createContentResponse: vi.fn(),
  updateContentResponse: vi.fn(),
  deleteContentResponse: vi.fn(),
  loadContentListItems: vi.fn(),
  loadContentById: vi.fn(),
  loadContentDetail: vi.fn(),
  loadContentHistory: vi.fn(),
  resolveContentAccess: vi.fn(),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({ requestId: 'req-content', traceId: 'trace-content' }),
  withRequestContext: async (_options: unknown, work: () => Promise<unknown>) => work(),
  toJsonErrorResponse: (status: number, code: string, message: string, options?: { requestId?: string }) =>
    new Response(JSON.stringify({ error: code, message, ...(options?.requestId ? { requestId: options.requestId } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('./iam-account-management/api-helpers.js', () => ({
  asApiItem: (...args: Parameters<typeof state.asApiItem>) => state.asApiItem(...args),
  asApiList: (...args: Parameters<typeof state.asApiList>) => state.asApiList(...args),
  createApiError: (...args: Parameters<typeof state.createApiError>) => state.createApiError(...args),
  readPathSegment: (...args: Parameters<typeof state.readPathSegment>) => state.readPathSegment(...args),
}));

vi.mock('./iam-contents/request-context.js', () => ({
  resolveContentActor: (...args: Parameters<typeof state.resolveContentActor>) => state.resolveContentActor(...args),
  resolveContentAccess: (...args: Parameters<typeof state.resolveContentAccess>) => state.resolveContentAccess(...args),
  withAuthenticatedContentHandler: (...args: Parameters<typeof state.withAuthenticatedContentHandler>) =>
    state.withAuthenticatedContentHandler(...args),
}));

vi.mock('./iam-contents/mutations.js', () => ({
  createContentResponse: (...args: Parameters<typeof state.createContentResponse>) => state.createContentResponse(...args),
  deleteContentResponse: (...args: Parameters<typeof state.deleteContentResponse>) => state.deleteContentResponse(...args),
  updateContentResponse: (...args: Parameters<typeof state.updateContentResponse>) => state.updateContentResponse(...args),
}));

vi.mock('./iam-contents/repository.js', () => ({
  loadContentById: (...args: Parameters<typeof state.loadContentById>) => state.loadContentById(...args),
  loadContentDetail: (...args: Parameters<typeof state.loadContentDetail>) => state.loadContentDetail(...args),
  loadContentHistory: (...args: Parameters<typeof state.loadContentHistory>) => state.loadContentHistory(...args),
  loadContentListItems: (...args: Parameters<typeof state.loadContentListItems>) => state.loadContentListItems(...args),
}));

import {
  createContentHandler,
  createContentInternal,
  getContentHandler,
  getContentHistoryInternal,
  getContentInternal,
  listContentsHandler,
  listContentsInternal,
  deleteContentHandler,
  deleteContentInternal,
  updateContentHandler,
  updateContentInternal,
} from './iam-contents/core.js';

const actorResolution = {
  actor: {
    instanceId: 'de-musterhausen',
    actorAccountId: 'account-1',
    keycloakSubject: 'user-1',
    actorDisplayName: 'Editor',
    requestId: 'req-content',
    traceId: 'trace-content',
  },
} as const;

const ctx = {
  user: { id: 'user-1', name: 'Editor', roles: ['editor'], instanceId: 'de-musterhausen' },
  sessionId: 'session-1',
} as const;

describe('iam-contents core', () => {
  beforeEach(() => {
    state.logger.error.mockClear();
    state.readPathSegment.mockReset();
    state.createApiError.mockClear();
    state.asApiList.mockClear();
    state.asApiItem.mockClear();
    state.resolveContentActor.mockReset();
    state.withAuthenticatedContentHandler.mockClear();
    state.createContentResponse.mockReset();
    state.updateContentResponse.mockReset();
    state.deleteContentResponse.mockReset();
    state.loadContentListItems.mockReset();
    state.loadContentById.mockReset();
    state.loadContentDetail.mockReset();
    state.loadContentHistory.mockReset();
    state.resolveContentAccess.mockReset();
    state.resolveContentAccess.mockResolvedValue({
      state: 'read_only',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'content_update_missing',
      organizationIds: [],
      sourceKinds: [],
    });
  });

  it('covers list handlers for actor errors, success and database failures', async () => {
    const actorError = new Response('forbidden', { status: 403 });
    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await listContentsInternal(new Request('http://localhost/api/v1/iam/contents'), ctx)).toBe(actorError);

    state.resolveContentActor.mockResolvedValueOnce(actorResolution);
    state.loadContentListItems.mockResolvedValueOnce([]);
    const successResponse = await listContentsInternal(new Request('http://localhost/api/v1/iam/contents'), ctx);
    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 1, total: 0 },
      requestId: 'req-content',
    });

    state.resolveContentActor.mockResolvedValueOnce(actorResolution);
    state.loadContentListItems.mockRejectedValueOnce(new Error('db down'));
    const failedResponse = await listContentsInternal(new Request('http://localhost/api/v1/iam/contents'), ctx);
    expect(failedResponse.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Content list query failed',
      expect.objectContaining({ error: 'db down' })
    );
  });

  it('covers detail and history branches for missing ids, not found and database errors', async () => {
    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.readPathSegment.mockReturnValueOnce('');
    expect((await getContentInternal(new Request('http://localhost/api/v1/iam/contents'), ctx)).status).toBe(400);

    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentDetail.mockResolvedValueOnce(undefined);
    expect((await getContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).status).toBe(404);

    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentDetail.mockRejectedValueOnce(new Error('db down'));
    expect((await getContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).status).toBe(503);

    state.readPathSegment.mockReturnValueOnce('');
    expect((await getContentHistoryInternal(new Request('http://localhost/api/v1/iam/contents/content-1/history'), ctx)).status).toBe(400);

    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentById.mockResolvedValueOnce(undefined);
    expect((await getContentHistoryInternal(new Request('http://localhost/api/v1/iam/contents/content-1/history'), ctx)).status).toBe(404);

    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentById.mockResolvedValueOnce({ id: 'content-1' });
    state.loadContentHistory.mockRejectedValueOnce(new Error('db down'));
    expect((await getContentHistoryInternal(new Request('http://localhost/api/v1/iam/contents/content-1/history'), ctx)).status).toBe(503);
  });

  it('returns detail and history payloads on successful reads', async () => {
    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.readPathSegment.mockReturnValue('content-1');
    state.loadContentDetail.mockResolvedValueOnce({
      id: 'content-1',
      title: 'Startseite',
      history: [],
    });

    const detailResponse = await getContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toEqual({
      data: {
        id: 'content-1',
        title: 'Startseite',
        history: [],
        access: {
          state: 'read_only',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          reasonCode: 'content_update_missing',
          organizationIds: [],
          sourceKinds: [],
        },
      },
      requestId: 'req-content',
    });

    state.loadContentById.mockResolvedValueOnce({ id: 'content-1' });
    state.loadContentHistory.mockResolvedValueOnce([{ id: 'history-1' }]);

    const historyResponse = await getContentHistoryInternal(
      new Request('http://localhost/api/v1/iam/contents/content-1/history'),
      ctx
    );
    expect(historyResponse.status).toBe(200);
    expect(await historyResponse.json()).toEqual({
      data: [{ id: 'history-1' }],
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-content',
    });
  });

  it('returns actor resolution errors for detail and history before reading the repository', async () => {
    const actorError = new Response('forbidden', { status: 403 });
    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await getContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).toBe(actorError);

    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await getContentHistoryInternal(new Request('http://localhost/api/v1/iam/contents/content-1/history'), ctx)).toBe(
      actorError
    );
  });

  it('maps non-error repository failures to database errors for list, detail and history', async () => {
    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.loadContentListItems.mockRejectedValueOnce('db down');

    expect((await listContentsInternal(new Request('http://localhost/api/v1/iam/contents'), ctx)).status).toBe(503);

    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentDetail.mockRejectedValueOnce('db down');
    expect((await getContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).status).toBe(503);

    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.readPathSegment.mockReturnValueOnce('content-1');
    state.loadContentById.mockResolvedValueOnce({ id: 'content-1' });
    state.loadContentHistory.mockRejectedValueOnce('db down');
    expect((await getContentHistoryInternal(new Request('http://localhost/api/v1/iam/contents/content-1/history'), ctx)).status).toBe(503);
  });

  it('delegates create, update and delete internals to mutations only after actor resolution succeeds', async () => {
    const actorError = new Response('forbidden', { status: 403 });
    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await createContentInternal(new Request('http://localhost/api/v1/iam/contents'), ctx)).toBe(actorError);

    const createResponse = new Response('created', { status: 201 });
    state.resolveContentActor.mockResolvedValueOnce(actorResolution);
    state.createContentResponse.mockResolvedValueOnce(createResponse);
    expect(await createContentInternal(new Request('http://localhost/api/v1/iam/contents'), ctx)).toBe(createResponse);

    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await updateContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).toBe(actorError);

    const updateResponse = new Response('updated', { status: 200 });
    state.resolveContentActor.mockResolvedValueOnce(actorResolution);
    state.updateContentResponse.mockResolvedValueOnce(updateResponse);
    expect(await updateContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1'), ctx)).toBe(updateResponse);

    state.resolveContentActor.mockResolvedValueOnce({ error: actorError });
    expect(await deleteContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1', { method: 'DELETE' }), ctx)).toBe(
      actorError
    );

    const deleteResponse = new Response('deleted', { status: 200 });
    state.resolveContentActor.mockResolvedValueOnce(actorResolution);
    state.deleteContentResponse.mockResolvedValueOnce(deleteResponse);
    expect(await deleteContentInternal(new Request('http://localhost/api/v1/iam/contents/content-1', { method: 'DELETE' }), ctx)).toBe(
      deleteResponse
    );
  });

  it('exposes handlers through the authenticated content wrapper', async () => {
    state.resolveContentActor.mockResolvedValue(actorResolution);
    state.loadContentListItems.mockResolvedValue([]);
    state.readPathSegment.mockReturnValue('content-1');
    state.loadContentById.mockResolvedValue({ id: 'content-1' });
    state.loadContentDetail.mockResolvedValue({
      id: 'content-1',
      history: [],
    });
    state.loadContentHistory.mockResolvedValue([]);
    state.createContentResponse.mockResolvedValue(new Response('created', { status: 201 }));
    state.updateContentResponse.mockResolvedValue(new Response('updated', { status: 200 }));
    state.deleteContentResponse.mockResolvedValue(new Response('deleted', { status: 200 }));

    await listContentsHandler(new Request('http://localhost/api/v1/iam/contents'));
    await getContentHandler(new Request('http://localhost/api/v1/iam/contents/content-1'));
    await createContentHandler(new Request('http://localhost/api/v1/iam/contents', { method: 'POST' }));
    await updateContentHandler(new Request('http://localhost/api/v1/iam/contents/content-1', { method: 'PATCH' }));
    await deleteContentHandler(new Request('http://localhost/api/v1/iam/contents/content-1', { method: 'DELETE' }));

    expect(state.createContentResponse).toHaveBeenCalledTimes(1);
    expect(state.updateContentResponse).toHaveBeenCalledTimes(1);
    expect(state.deleteContentResponse).toHaveBeenCalledTimes(1);
  });
});
