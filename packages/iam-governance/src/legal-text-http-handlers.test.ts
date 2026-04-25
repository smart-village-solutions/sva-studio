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
});
