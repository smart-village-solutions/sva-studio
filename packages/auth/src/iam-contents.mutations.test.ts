import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: { error: vi.fn() },
  validateCsrf: vi.fn(),
  requireIdempotencyKey: vi.fn(),
  parseRequestBody: vi.fn(),
  toPayloadHash: vi.fn(() => 'payload-hash'),
  readPathSegment: vi.fn(),
  createApiError: vi.fn((status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
  createContent: vi.fn(),
  updateContent: vi.fn(),
  loadContentDetail: vi.fn(),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./iam-account-management/api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  createApiError: (...args: Parameters<typeof state.createApiError>) => state.createApiError(...args),
  parseRequestBody: (...args: Parameters<typeof state.parseRequestBody>) => state.parseRequestBody(...args),
  readPathSegment: (...args: Parameters<typeof state.readPathSegment>) => state.readPathSegment(...args),
  requireIdempotencyKey: (...args: Parameters<typeof state.requireIdempotencyKey>) => state.requireIdempotencyKey(...args),
  toPayloadHash: (...args: Parameters<typeof state.toPayloadHash>) => state.toPayloadHash(...args),
}));

vi.mock('./iam-account-management/csrf.js', () => ({
  validateCsrf: (...args: Parameters<typeof state.validateCsrf>) => state.validateCsrf(...args),
}));

vi.mock('./iam-account-management/shared.js', () => ({
  completeIdempotency: (...args: Parameters<typeof state.completeIdempotency>) => state.completeIdempotency(...args),
  reserveIdempotency: (...args: Parameters<typeof state.reserveIdempotency>) => state.reserveIdempotency(...args),
}));

vi.mock('./iam-contents/repository.js', () => ({
  createContent: (...args: Parameters<typeof state.createContent>) => state.createContent(...args),
  loadContentDetail: (...args: Parameters<typeof state.loadContentDetail>) => state.loadContentDetail(...args),
  updateContent: (...args: Parameters<typeof state.updateContent>) => state.updateContent(...args),
}));

import { createContentResponse, updateContentResponse } from './iam-contents/mutations.js';

const actor = {
  instanceId: 'de-musterhausen',
  actorAccountId: 'account-1',
  actorDisplayName: 'Editor',
  requestId: 'req-content',
  traceId: 'trace-content',
} as const;

const createRequest = () =>
  new Request('http://localhost/api/v1/iam/contents', {
    method: 'POST',
    body: JSON.stringify({ title: 'Startseite' }),
  });

const updateRequest = () =>
  new Request('http://localhost/api/v1/iam/contents/content-1', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Neu' }),
  });

describe('iam-contents mutations', () => {
  beforeEach(() => {
    state.logger.error.mockClear();
    state.validateCsrf.mockReset();
    state.requireIdempotencyKey.mockReset();
    state.parseRequestBody.mockReset();
    state.toPayloadHash.mockClear();
    state.readPathSegment.mockReset();
    state.createApiError.mockClear();
    state.reserveIdempotency.mockReset();
    state.completeIdempotency.mockReset();
    state.createContent.mockReset();
    state.updateContent.mockReset();
    state.loadContentDetail.mockReset();
  });

  it('short-circuits create when csrf, idempotency or body parsing fails', async () => {
    const csrfError = new Response('csrf', { status: 403 });
    state.validateCsrf.mockReturnValueOnce(csrfError);
    expect((await createContentResponse(createRequest(), actor)).status).toBe(403);

    state.validateCsrf.mockReturnValueOnce(null);
    const idempotencyError = new Response('idempotency', { status: 400 });
    state.requireIdempotencyKey.mockReturnValueOnce({ error: idempotencyError });
    expect((await createContentResponse(createRequest(), actor)).status).toBe(400);

    state.requireIdempotencyKey.mockReturnValueOnce({ key: 'idem-1' });
    state.parseRequestBody.mockResolvedValueOnce({ ok: false, message: 'bad-body' });
    const invalidResponse = await createContentResponse(createRequest(), actor);
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toEqual({
      error: { code: 'invalid_request', message: 'bad-body' },
      requestId: 'req-content',
    });
  });

  it('returns replay and conflict responses for create idempotency reservations', async () => {
    state.validateCsrf.mockReturnValue(null);
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.parseRequestBody.mockResolvedValue({ ok: true, rawBody: '{}', data: { title: 'Startseite', contentType: 'generic' } });
    state.reserveIdempotency.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { id: 'content-1' } },
    });

    const replayResponse = await createContentResponse(createRequest(), actor);
    expect(replayResponse.status).toBe(202);
    expect(await replayResponse.json()).toEqual({ data: { id: 'content-1' } });

    state.reserveIdempotency.mockResolvedValueOnce({
      status: 'conflict',
      message: 'already used',
    });

    const conflictResponse = await createContentResponse(createRequest(), actor);
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toEqual({
      error: { code: 'idempotency_key_reuse', message: 'already used' },
      requestId: 'req-content',
    });
  });

  it('completes successful create requests and persists failed create attempts', async () => {
    state.validateCsrf.mockReturnValue(null);
    state.requireIdempotencyKey.mockReturnValue({ key: 'idem-1' });
    state.parseRequestBody.mockResolvedValue({ ok: true, rawBody: '{}', data: { title: 'Startseite', contentType: 'generic' } });
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.createContent.mockResolvedValueOnce('content-1');
    state.loadContentDetail.mockResolvedValueOnce({ id: 'content-1', title: 'Startseite', history: [] });

    const successResponse = await createContentResponse(createRequest(), actor);
    expect(successResponse.status).toBe(201);
    expect(await successResponse.json()).toEqual({
      data: { id: 'content-1', title: 'Startseite', history: [] },
      requestId: 'req-content',
    });
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 })
    );

    state.createContent.mockRejectedValueOnce(new Error('content_published_at_required'));
    const publishedAtResponse = await createContentResponse(createRequest(), actor);
    expect(publishedAtResponse.status).toBe(400);
    expect(await publishedAtResponse.json()).toEqual({
      error: {
        code: 'invalid_request',
        message: 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
      },
      requestId: 'req-content',
    });

    state.createContent.mockResolvedValueOnce('content-2');
    state.loadContentDetail.mockResolvedValueOnce(undefined);
    const missingCreatedResponse = await createContentResponse(createRequest(), actor);
    expect(missingCreatedResponse.status).toBe(503);

    state.createContent.mockRejectedValueOnce(new Error('db down'));
    const failedResponse = await createContentResponse(createRequest(), actor);
    expect(failedResponse.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Content create failed',
      expect.objectContaining({ error: 'db down', request_id: 'req-content' })
    );
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', responseStatus: 503 })
    );
  });

  it('covers update request validation and response branches', async () => {
    const csrfError = new Response('csrf', { status: 403 });
    state.validateCsrf.mockReturnValueOnce(csrfError);
    expect((await updateContentResponse(updateRequest(), actor)).status).toBe(403);

    state.validateCsrf.mockReturnValue(null);
    state.readPathSegment.mockReturnValueOnce('');
    const missingIdResponse = await updateContentResponse(updateRequest(), actor);
    expect(missingIdResponse.status).toBe(400);

    state.readPathSegment.mockReturnValue('content-1');
    state.parseRequestBody.mockResolvedValueOnce({ ok: false, message: 'bad-update' });
    const invalidBodyResponse = await updateContentResponse(updateRequest(), actor);
    expect(invalidBodyResponse.status).toBe(400);

    state.parseRequestBody.mockResolvedValue({ ok: true, rawBody: '{}', data: { title: 'Neu' } });
    state.updateContent.mockResolvedValueOnce(undefined);
    const notFoundResponse = await updateContentResponse(updateRequest(), actor);
    expect(notFoundResponse.status).toBe(404);

    state.updateContent.mockResolvedValueOnce('content-1');
    state.loadContentDetail.mockResolvedValueOnce(undefined);
    const missingLoadedResponse = await updateContentResponse(updateRequest(), actor);
    expect(missingLoadedResponse.status).toBe(404);

    state.updateContent.mockResolvedValueOnce('content-1');
    state.loadContentDetail.mockResolvedValueOnce({ id: 'content-1', title: 'Neu', history: [] });
    const successResponse = await updateContentResponse(updateRequest(), actor);
    expect(successResponse.status).toBe(200);

    state.updateContent.mockRejectedValueOnce(new Error('content_published_at_required'));
    const publishedRequiredResponse = await updateContentResponse(updateRequest(), actor);
    expect(publishedRequiredResponse.status).toBe(400);

    state.updateContent.mockRejectedValueOnce(new Error('db down'));
    const failedResponse = await updateContentResponse(updateRequest(), actor);
    expect(failedResponse.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Content update failed',
      expect.objectContaining({ content_id: 'content-1', error: 'db down' })
    );
  });
});
