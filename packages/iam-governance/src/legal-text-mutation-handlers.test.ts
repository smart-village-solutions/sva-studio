import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLegalTextMutationHandlers,
  type LegalTextMutationHandlerDeps,
} from './legal-text-mutation-handlers.js';
import { LegalTextDeleteConflictError } from './legal-text-repository.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'account-1',
  requestId: 'req-legal-text',
  traceId: 'trace-legal-text',
};

const createDeps = (): LegalTextMutationHandlerDeps => ({
  validateCsrf: vi.fn(() => null),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  parseRequestBody: vi.fn(async () => ({
    ok: true,
    data: {
      name: 'Privacy Policy',
      legalTextVersion: '2026-04',
      locale: 'de-DE',
      contentHtml: '<p>Legal text</p>',
      status: 'draft',
    },
    rawBody: '{}',
  })),
  toPayloadHash: vi.fn(() => 'hash-1'),
  reserveIdempotency: vi.fn(async () => ({ status: 'reserved' })),
  completeIdempotency: vi.fn(async () => undefined),
  readPathSegment: vi.fn(() => '11111111-1111-1111-1111-111111111111'),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ code, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  asApiItem: vi.fn((value, requestId) => ({ item: value, requestId })),
  jsonResponse: vi.fn((status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  repository: {
    createLegalTextVersion: vi.fn(async () => 'created-id'),
    updateLegalTextVersion: vi.fn(async () => 'updated-id'),
    deleteLegalTextVersion: vi.fn(async () => '11111111-1111-1111-1111-111111111111'),
    loadLegalTextById: vi.fn(async (_instanceId, id) => ({ id, name: 'Privacy Policy' })),
  },
  logError: vi.fn(),
});

describe('legal-text-mutation-handlers', () => {
  let deps: LegalTextMutationHandlerDeps;

  beforeEach(() => {
    deps = createDeps();
  });

  it('creates legal texts with idempotency completion', async () => {
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(201);
    expect(body.item).toMatchObject({ id: 'created-id' });
    expect(deps.reserveIdempotency).toHaveBeenCalledWith(expect.objectContaining({ payloadHash: 'hash-1' }));
    expect(deps.completeIdempotency).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('replays reserved create responses without touching the repository', async () => {
    vi.mocked(deps.reserveIdempotency).mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 201,
      responseBody: { replayed: true },
    });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(201);
    expect(body).toEqual({ replayed: true });
    expect(deps.repository.createLegalTextVersion).not.toHaveBeenCalled();
  });

  it('updates legal texts and reloads the response item', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: true,
      data: { status: 'archived' },
      rawBody: '{}',
    });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'), actor);

    expect(response.status).toBe(200);
    expect(deps.repository.updateLegalTextVersion).toHaveBeenCalledWith(
      expect.objectContaining({ legalTextVersionId: '11111111-1111-1111-1111-111111111111', status: 'archived' })
    );
  });

  it('maps legal text delete conflicts to API conflicts', async () => {
    vi.mocked(deps.repository.deleteLegalTextVersion).mockRejectedValueOnce(new LegalTextDeleteConflictError());
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('conflict');
  });
});
