import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLegalTextHttpHandlers, type LegalTextHttpHandlerDeps } from './legal-text-http-handlers.js';

type TestContext = { userId: string };

const readBody = async (response: Response) => JSON.parse(await response.text());

const createDeps = (): LegalTextHttpHandlerDeps<TestContext> => ({
  resolveAdminActor: vi.fn(async () => ({
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-legal-text',
      traceId: 'trace-legal-text',
    },
  })),
  getRequestId: vi.fn(() => 'req-legal-text'),
  asApiList: vi.fn((items, pagination, requestId) => ({ items, pagination, requestId })),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ code, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  jsonResponse: vi.fn((status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  loadLegalTextListItems: vi.fn(async () => [{ id: 'legal-text-1' }]),
  loadPendingLegalTexts: vi.fn(async () => [{ id: 'pending-1' }]),
  createLegalTextResponse: vi.fn(async () => new Response('created', { status: 201 })),
  updateLegalTextResponse: vi.fn(async () => new Response('updated', { status: 200 })),
  deleteLegalTextResponse: vi.fn(async () => new Response('deleted', { status: 200 })),
  logError: vi.fn(),
});

describe('legal-text-http-handlers', () => {
  let deps: LegalTextHttpHandlerDeps<TestContext>;

  beforeEach(() => {
    deps = createDeps();
  });

  it('lists legal texts with stable pagination metadata', async () => {
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listLegalTexts(new Request('https://example.org'), { userId: 'u-1' });
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      items: [{ id: 'legal-text-1' }],
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-legal-text',
    });
  });

  it('returns admin actor errors before querying legal texts', async () => {
    vi.mocked(deps.resolveAdminActor).mockResolvedValueOnce({ error: new Response('forbidden', { status: 403 }) });
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listLegalTexts(new Request('https://example.org'), { userId: 'u-1' });

    expect(response.status).toBe(403);
    expect(deps.loadLegalTextListItems).not.toHaveBeenCalled();
  });

  it('lists pending legal texts for authenticated users with an instance context', async () => {
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listPendingLegalTexts({ id: 'kc-user-1', instanceId: 'de-musterhausen' });
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body.items).toEqual([{ id: 'pending-1' }]);
    expect(deps.loadPendingLegalTexts).toHaveBeenCalledWith('de-musterhausen', 'kc-user-1');
  });

  it('rejects pending legal text reads without an instance context', async () => {
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listPendingLegalTexts({ id: 'kc-user-1' });
    const body = await readBody(response);

    expect(response.status).toBe(401);
    expect(body.code).toBe('unauthorized');
  });

  it('logs and maps list query failures to a database_unavailable response', async () => {
    vi.mocked(deps.loadLegalTextListItems).mockRejectedValueOnce(new Error('db down'));
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listLegalTexts(new Request('https://example.org'), { userId: 'u-1' });
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body.code).toBe('database_unavailable');
    expect(deps.logError).toHaveBeenCalledWith(
      'Legal text list query failed',
      expect.objectContaining({
        operation: 'legal_texts_list',
        instance_id: 'de-musterhausen',
        error: 'db down',
      })
    );
  });

  it('delegates create, update and delete only after admin actor resolution succeeds', async () => {
    const handlers = createLegalTextHttpHandlers(deps);

    const createResponse = await handlers.createLegalText(new Request('https://example.org', { method: 'POST' }), {
      userId: 'u-1',
    });
    const updateResponse = await handlers.updateLegalText(new Request('https://example.org', { method: 'PATCH' }), {
      userId: 'u-1',
    });
    const deleteResponse = await handlers.deleteLegalText(new Request('https://example.org', { method: 'DELETE' }), {
      userId: 'u-1',
    });

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(deps.resolveAdminActor).toHaveBeenNthCalledWith(
      1,
      expect.any(Request),
      { userId: 'u-1' },
      { requireActorAccountId: true }
    );
    expect(deps.createLegalTextResponse).toHaveBeenCalled();
    expect(deps.updateLegalTextResponse).toHaveBeenCalled();
    expect(deps.deleteLegalTextResponse).toHaveBeenCalled();
  });

  it('returns actor resolution errors for create, update and delete before delegating', async () => {
    const forbidden = new Response('forbidden', { status: 403 });
    vi.mocked(deps.resolveAdminActor)
      .mockResolvedValueOnce({ error: forbidden })
      .mockResolvedValueOnce({ error: forbidden })
      .mockResolvedValueOnce({ error: forbidden });
    const handlers = createLegalTextHttpHandlers(deps);

    await expect(
      handlers.createLegalText(new Request('https://example.org', { method: 'POST' }), { userId: 'u-1' })
    ).resolves.toBe(forbidden);
    await expect(
      handlers.updateLegalText(new Request('https://example.org', { method: 'PATCH' }), { userId: 'u-1' })
    ).resolves.toBe(forbidden);
    await expect(
      handlers.deleteLegalText(new Request('https://example.org', { method: 'DELETE' }), { userId: 'u-1' })
    ).resolves.toBe(forbidden);

    expect(deps.createLegalTextResponse).not.toHaveBeenCalled();
    expect(deps.updateLegalTextResponse).not.toHaveBeenCalled();
    expect(deps.deleteLegalTextResponse).not.toHaveBeenCalled();
  });

  it('logs pending list failures with the user context', async () => {
    vi.mocked(deps.loadPendingLegalTexts).mockRejectedValueOnce(new Error('query failed'));
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listPendingLegalTexts({ id: 'kc-user-1', instanceId: 'de-musterhausen' });
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body.code).toBe('database_unavailable');
    expect(deps.logError).toHaveBeenCalledWith(
      'Pending legal text query failed',
      expect.objectContaining({
        operation: 'legal_texts_pending',
        instance_id: 'de-musterhausen',
        user_id: 'kc-user-1',
        error: 'query failed',
      })
    );
  });

  it('keeps pagination fail-closed at pageSize 1 for empty legal text lists', async () => {
    vi.mocked(deps.loadLegalTextListItems).mockResolvedValueOnce([]);
    const handlers = createLegalTextHttpHandlers(deps);

    const response = await handlers.listLegalTexts(new Request('https://example.org'), { userId: 'u-1' });
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      items: [],
      pagination: { page: 1, pageSize: 1, total: 0 },
    });
  });
});
