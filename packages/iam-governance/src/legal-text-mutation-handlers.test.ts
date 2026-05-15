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

  it('returns the csrf error before create processing starts', async () => {
    const csrfError = new Response('csrf', { status: 403 });
    vi.mocked(deps.validateCsrf).mockReturnValueOnce(csrfError);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);

    expect(response).toBe(csrfError);
    expect(deps.requireIdempotencyKey).not.toHaveBeenCalled();
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

  it('returns the required idempotency error before parsing the create body', async () => {
    const idempotencyError = new Response('missing-idempotency', { status: 400 });
    vi.mocked(deps.requireIdempotencyKey).mockReturnValueOnce({ error: idempotencyError });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);

    expect(response).toBe(idempotencyError);
    expect(deps.parseRequestBody).not.toHaveBeenCalled();
  });

  it('returns invalid_request when create body parsing fails', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: false,
      message: 'Body invalid',
    });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
    expect(deps.reserveIdempotency).not.toHaveBeenCalled();
  });

  it('rejects create requests when the idempotency key is reused with a different payload', async () => {
    vi.mocked(deps.reserveIdempotency).mockResolvedValueOnce({
      status: 'conflict',
      message: 'Payload mismatch',
    });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('idempotency_key_reuse');
    expect(deps.repository.createLegalTextVersion).not.toHaveBeenCalled();
    expect(deps.completeIdempotency).not.toHaveBeenCalled();
  });

  it('returns a failed idempotent conflict when the repository does not create a legal text version', async () => {
    vi.mocked(deps.repository.createLegalTextVersion).mockResolvedValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.error).toEqual({
      code: 'conflict',
      message: 'Diese Rechtstext-Version existiert bereits.',
    });
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        responseStatus: 409,
        responseBody: body,
      })
    );
  });

  it('maps published-at validation failures during create to invalid requests', async () => {
    vi.mocked(deps.repository.createLegalTextVersion).mockRejectedValueOnce(
      new Error('legal_text_published_at_required')
    );
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toEqual({
      code: 'invalid_request',
      message: 'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.',
    });
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        responseStatus: 400,
      })
    );
  });

  it('returns a database error when the created legal text cannot be reloaded', async () => {
    vi.mocked(deps.repository.loadLegalTextById).mockResolvedValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body.error).toEqual({
      code: 'database_unavailable',
      message: 'Rechtstext konnte nicht gespeichert werden.',
    });
    expect(deps.logError).toHaveBeenCalledWith(
      'Legal text create failed',
      expect.objectContaining({ error: 'created_legal_text_not_found' })
    );
    expect(deps.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        responseStatus: 503,
        responseBody: body,
      })
    );
  });

  it('rejects create requests without an actor account', async () => {
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.createLegalTextResponse(new Request('https://example.org'), {
      ...actor,
      actorAccountId: undefined,
    });
    const body = await readBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe('forbidden');
    expect(deps.parseRequestBody).not.toHaveBeenCalled();
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

  it('returns the csrf error before update processing starts', async () => {
    const csrfError = new Response('csrf', { status: 403 });
    vi.mocked(deps.validateCsrf).mockReturnValueOnce(csrfError);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );

    expect(response).toBe(csrfError);
    expect(deps.parseRequestBody).not.toHaveBeenCalled();
  });

  it('returns invalid_request when update body parsing fails', async () => {
    vi.mocked(deps.parseRequestBody).mockResolvedValueOnce({
      ok: false,
      message: 'Update invalid',
    });
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
    expect(deps.repository.updateLegalTextVersion).not.toHaveBeenCalled();
  });

  it('returns not found when the repository does not update a legal text version', async () => {
    vi.mocked(deps.repository.updateLegalTextVersion).mockResolvedValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
    expect(deps.repository.loadLegalTextById).not.toHaveBeenCalled();
  });

  it('returns not found when an updated legal text version cannot be reloaded', async () => {
    vi.mocked(deps.repository.loadLegalTextById).mockResolvedValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('maps published-at validation failures during update to invalid requests', async () => {
    vi.mocked(deps.repository.updateLegalTextVersion).mockRejectedValueOnce(
      new Error('legal_text_published_at_required')
    );
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.updateLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('maps legal text delete conflicts to API conflicts', async () => {
    vi.mocked(deps.repository.deleteLegalTextVersion).mockRejectedValueOnce(new LegalTextDeleteConflictError());
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'), actor);
    const body = await readBody(response);

    expect(response.status).toBe(409);
    expect(body.code).toBe('conflict');
  });

  it('returns the csrf error before delete processing starts', async () => {
    const csrfError = new Response('csrf', { status: 403 });
    vi.mocked(deps.validateCsrf).mockReturnValueOnce(csrfError);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );

    expect(response).toBe(csrfError);
    expect(deps.readPathSegment).not.toHaveBeenCalled();
  });

  it('returns invalid_request when delete is missing the legal text id', async () => {
    vi.mocked(deps.readPathSegment).mockReturnValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
    expect(deps.repository.deleteLegalTextVersion).not.toHaveBeenCalled();
  });

  it('rejects invalid legal text ids before delete reaches the repository', async () => {
    vi.mocked(deps.readPathSegment).mockReturnValueOnce('not-a-uuid');
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/not-a-uuid'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
    expect(deps.repository.deleteLegalTextVersion).not.toHaveBeenCalled();
  });

  it('rejects delete requests without an actor account', async () => {
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      {
        ...actor,
        actorAccountId: undefined,
      }
    );
    const body = await readBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe('forbidden');
    expect(deps.repository.deleteLegalTextVersion).not.toHaveBeenCalled();
  });

  it('returns not found when delete does not remove a legal text version', async () => {
    vi.mocked(deps.repository.deleteLegalTextVersion).mockResolvedValueOnce(undefined);
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('maps unexpected delete failures to database_unavailable', async () => {
    vi.mocked(deps.repository.deleteLegalTextVersion).mockRejectedValueOnce(new Error('db down'));
    const handlers = createLegalTextMutationHandlers(deps);

    const response = await handlers.deleteLegalTextResponse(
      new Request('https://example.org/api/v1/iam/legal-texts/11111111-1111-1111-1111-111111111111'),
      actor
    );
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body.code).toBe('database_unavailable');
    expect(deps.logError).toHaveBeenCalledWith(
      'Legal text delete failed',
      expect.objectContaining({ error: 'db down' })
    );
  });
});
