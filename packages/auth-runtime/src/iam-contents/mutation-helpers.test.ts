import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  completeIdempotencyMock: vi.fn(),
  createApiErrorMock: vi.fn(),
  parseRequestBodyMock: vi.fn(),
  requireIdempotencyKeyMock: vi.fn(),
  reserveIdempotencyMock: vi.fn(),
  toPayloadHashMock: vi.fn(),
  validateContentTypePayloadMock: vi.fn(),
  validateCsrfMock: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  completeIdempotency: (...args: unknown[]) => state.completeIdempotencyMock(...args),
  reserveIdempotency: (...args: unknown[]) => state.reserveIdempotencyMock(...args),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  createApiError: (...args: unknown[]) => state.createApiErrorMock(...args),
  parseRequestBody: (...args: unknown[]) => state.parseRequestBodyMock(...args),
  requireIdempotencyKey: (...args: unknown[]) => state.requireIdempotencyKeyMock(...args),
  toPayloadHash: (...args: unknown[]) => state.toPayloadHashMock(...args),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: (...args: unknown[]) => state.validateCsrfMock(...args),
}));

vi.mock('./content-type-registry.js', () => ({
  validateContentTypePayload: (...args: unknown[]) => state.validateContentTypePayloadMock(...args),
}));

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
}));

const {
  createFailureResponse,
  createFailureResponseFromResponse,
  parseCreateRequest,
  reserveCreateIdempotency,
} = await import('./mutation-helpers.js');

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorAccountId: 'account-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
};

describe('content mutation helpers', () => {
  beforeEach(() => {
    for (const mock of Object.values(state)) {
      mock.mockReset();
    }

    state.completeIdempotencyMock.mockResolvedValue(undefined);
    state.validateCsrfMock.mockReturnValue(null);
    state.requireIdempotencyKeyMock.mockReturnValue({ key: 'idem-1' });
    state.parseRequestBodyMock.mockResolvedValue({
      ok: true,
      rawBody: '{"contentType":"news.article","payload":{"body":"Text"}}',
      data: {
        contentType: 'news.article',
        title: 'Titel',
        payload: { body: 'Text' },
        status: 'draft',
        validationState: 'valid',
      },
    });
    state.validateContentTypePayloadMock.mockReturnValue({ ok: true, payload: { body: 'Text' } });
    state.toPayloadHashMock.mockReturnValue('hash-1');
    state.reserveIdempotencyMock.mockResolvedValue({ status: 'reserved' });
    state.createApiErrorMock.mockImplementation(
      (status: number, code: string, message: string, requestId?: string) =>
        new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    );
  });

  it('stores explicit create failures as failed idempotent responses', async () => {
    const response = await createFailureResponse(actor, 'idem-1', 400, 'invalid_request', 'Ungültig');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'Ungültig' },
      requestId: 'request-1',
    });
    expect(state.completeIdempotencyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        responseStatus: 400,
        status: 'FAILED',
      })
    );
  });

  it('preserves authorization failure status and response body for idempotent create failures', async () => {
    const authorizationResponse = new Response(
      JSON.stringify({
        error: { code: 'database_unavailable', message: 'Berechtigungen konnten nicht geprüft werden.' },
        requestId: 'request-1',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );

    const response = await createFailureResponseFromResponse(actor, 'idem-1', authorizationResponse);

    await expect(response.json()).resolves.toEqual({
      error: { code: 'database_unavailable', message: 'Berechtigungen konnten nicht geprüft werden.' },
      requestId: 'request-1',
    });
    expect(response.status).toBe(503);
  });

  it('falls back to a generic authorization body when the response is not json', async () => {
    const response = await createFailureResponseFromResponse(actor, 'idem-1', new Response('forbidden', { status: 403 }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'forbidden', message: 'Keine Berechtigung für diese Inhaltsoperation.' },
      requestId: 'request-1',
    });
  });

  it('parses valid create requests and returns the normalized payload', async () => {
    const result = await parseCreateRequest(new Request('https://studio.test/api/v1/iam/contents'), actor);

    expect(result).toMatchObject({
      idempotencyKey: 'idem-1',
      rawBody: '{"contentType":"news.article","payload":{"body":"Text"}}',
      parsedData: expect.objectContaining({ contentType: 'news.article' }),
      payload: { body: 'Text' },
    });
  });

  it('returns early for csrf, idempotency, schema and payload validation errors', async () => {
    const csrfResponse = new Response('csrf', { status: 403 });
    state.validateCsrfMock.mockReturnValueOnce(csrfResponse);
    expect(await parseCreateRequest(new Request('https://studio.test/api/v1/iam/contents'), actor)).toBe(csrfResponse);

    const idempotencyResponse = new Response('missing-idem', { status: 400 });
    state.requireIdempotencyKeyMock.mockReturnValueOnce({ error: idempotencyResponse });
    expect(await parseCreateRequest(new Request('https://studio.test/api/v1/iam/contents'), actor)).toBe(idempotencyResponse);

    state.parseRequestBodyMock.mockResolvedValueOnce({ ok: false, message: 'Body ungültig' });
    const parseError = await parseCreateRequest(new Request('https://studio.test/api/v1/iam/contents'), actor);
    expect((parseError as Response).status).toBe(400);

    state.validateContentTypePayloadMock.mockReturnValueOnce({ ok: false, message: 'Payload ungültig' });
    const payloadError = await parseCreateRequest(new Request('https://studio.test/api/v1/iam/contents'), actor);
    expect((payloadError as Response).status).toBe(400);
  });

  it('replays or rejects reserved idempotency keys based on the shared store result', async () => {
    state.reserveIdempotencyMock.mockResolvedValueOnce({
      status: 'replay',
      responseStatus: 201,
      responseBody: { data: { id: 'content-1' }, requestId: 'request-1' },
    });
    const replay = await reserveCreateIdempotency(actor, 'idem-1', '{"a":1}');
    expect(replay?.status).toBe(201);

    state.reserveIdempotencyMock.mockResolvedValueOnce({ status: 'conflict', message: 'bereits verwendet' });
    const conflict = await reserveCreateIdempotency(actor, 'idem-1', '{"a":2}');
    expect(conflict?.status).toBe(409);

    state.reserveIdempotencyMock.mockResolvedValueOnce({ status: 'reserved' });
    await expect(reserveCreateIdempotency(actor, 'idem-2', '{"a":3}')).resolves.toBeNull();
    expect(state.toPayloadHashMock).toHaveBeenCalled();
  });
});
