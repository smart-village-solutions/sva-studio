import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorizeContentActionMock: vi.fn(),
  authorizeUpdateContentActionsMock: vi.fn(),
  createContentMock: vi.fn(),
  createFailureResponseFromResponseMock: vi.fn(),
  createFailureResponseMock: vi.fn(),
  completeCreateIdempotencyMock: vi.fn(),
  createApiErrorMock: vi.fn(),
  deleteContentMock: vi.fn(),
  isContentStateValidationErrorMock: vi.fn(),
  loadContentByIdMock: vi.fn(),
  loadContentDetailMock: vi.fn(),
  loadContentRowByIdMock: vi.fn(),
  logCreateFailureMock: vi.fn(),
  mapContentListItemMock: vi.fn(),
  parseCreateRequestMock: vi.fn(),
  parseRequestBodyMock: vi.fn(),
  readPathSegmentMock: vi.fn(),
  reserveCreateIdempotencyMock: vi.fn(),
  resolveContentAccessMock: vi.fn(),
  updateContentMock: vi.fn(),
  validateContentTypePayloadMock: vi.fn(),
  validateCsrfMock: vi.fn(),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: vi.fn(),
  createApiError: (...args: unknown[]) => state.createApiErrorMock(...args),
  parseRequestBody: (...args: unknown[]) => state.parseRequestBodyMock(...args),
  readPathSegment: (...args: unknown[]) => state.readPathSegmentMock(...args),
}));

vi.mock('../db.js', () => ({
  jsonResponse: (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: (...args: unknown[]) => state.validateCsrfMock(...args),
}));

vi.mock('./content-type-registry.js', () => ({
  validateContentTypePayload: (...args: unknown[]) => state.validateContentTypePayloadMock(...args),
}));

vi.mock('./mutation-authorization.js', () => ({
  authorizeUpdateContentActions: (...args: unknown[]) => state.authorizeUpdateContentActionsMock(...args),
}));

vi.mock('./mutation-helpers.js', () => ({
  createFailureResponse: (...args: unknown[]) => state.createFailureResponseMock(...args),
  createFailureResponseFromResponse: (...args: unknown[]) => state.createFailureResponseFromResponseMock(...args),
  logCreateFailure: (...args: unknown[]) => state.logCreateFailureMock(...args),
  parseCreateRequest: (...args: unknown[]) => state.parseCreateRequestMock(...args),
  reserveCreateIdempotency: (...args: unknown[]) => state.reserveCreateIdempotencyMock(...args),
  completeCreateIdempotency: (...args: unknown[]) => state.completeCreateIdempotencyMock(...args),
}));

vi.mock('./request-context.js', () => ({
  authorizeContentAction: (...args: unknown[]) => state.authorizeContentActionMock(...args),
  resolveContentAccess: (...args: unknown[]) => state.resolveContentAccessMock(...args),
}));

vi.mock('./repository.js', () => ({
  createContent: (...args: unknown[]) => state.createContentMock(...args),
  deleteContent: (...args: unknown[]) => state.deleteContentMock(...args),
  loadContentById: (...args: unknown[]) => state.loadContentByIdMock(...args),
  loadContentDetail: (...args: unknown[]) => state.loadContentDetailMock(...args),
  loadContentRowById: (...args: unknown[]) => state.loadContentRowByIdMock(...args),
  updateContent: (...args: unknown[]) => state.updateContentMock(...args),
}));

vi.mock('./repository-mappers.js', () => ({
  mapContentListItem: (...args: unknown[]) => state.mapContentListItemMock(...args),
}));

vi.mock('./repository-state-validation.js', () => ({
  isContentStateValidationError: (...args: unknown[]) => state.isContentStateValidationErrorMock(...args),
}));

vi.mock('./schemas.js', () => ({
  updateContentSchema: {},
}));

const { createContentResponse, deleteContentResponse, updateContentResponse } = await import('./mutations.js');

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'subject-1',
  actorAccountId: 'account-1',
  actorDisplayName: 'Actor',
  requestId: 'request-1',
  activeOrganizationId: '11111111-1111-4111-8111-111111111111',
} as const;

describe('content mutations', () => {
  beforeEach(() => {
    for (const mock of Object.values(state)) {
      mock.mockReset();
    }

    state.parseCreateRequestMock.mockResolvedValue({
      idempotencyKey: 'idem-1',
      rawBody: '{"contentType":"news.article"}',
      parsedData: {
        contentType: 'news.article',
        title: 'Titel',
        payload: { body: 'Text' },
        status: 'draft',
        validationState: 'valid',
      },
      payload: { body: 'Text' },
    });
    state.reserveCreateIdempotencyMock.mockResolvedValue(null);
    state.authorizeContentActionMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'forbidden', message: 'Keine Berechtigung für diese Inhaltsoperation.' },
          requestId: 'request-1',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
    state.createFailureResponseFromResponseMock.mockResolvedValue(new Response('forbidden', { status: 403 }));
    state.createFailureResponseMock.mockImplementation(
      async (_actor: unknown, _idempotencyKey: string, status: number, code: string, message: string) =>
        new Response(JSON.stringify({ error: { code, message } }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    state.resolveContentAccessMock.mockResolvedValue({ canRead: true });
    state.loadContentDetailMock.mockResolvedValue({ id: 'content-1', history: [] });
    state.createContentMock.mockResolvedValue('content-1');
    state.completeCreateIdempotencyMock.mockResolvedValue(undefined);
    state.authorizeUpdateContentActionsMock.mockResolvedValue(null);
    state.validateCsrfMock.mockReturnValue(null);
    state.readPathSegmentMock.mockReturnValue('content-1');
    state.parseRequestBodyMock.mockResolvedValue({ ok: true, data: { title: 'Neu' } });
    state.loadContentByIdMock.mockResolvedValue({
      id: 'content-1',
      contentType: 'news.article',
      organizationId: '11111111-1111-4111-8111-111111111111',
      status: 'draft',
    });
    state.validateContentTypePayloadMock.mockReturnValue({ ok: true, payload: { body: 'Text' } });
    state.updateContentMock.mockResolvedValue('content-1');
    state.loadContentRowByIdMock.mockResolvedValue({
      id: 'content-1',
      content_type: 'news.article',
      instance_id: 'instance-1',
      organization_id: '11111111-1111-4111-8111-111111111111',
      owner_subject_id: null,
      title: 'Titel',
      published_at: null,
      publish_from: null,
      publish_until: null,
      created_at: '2026-04-26T10:00:00.000Z',
      created_by: 'creator-1',
      updated_at: '2026-04-26T10:00:00.000Z',
      updated_by: 'updater-1',
      author_display_name: 'Actor',
      payload_json: {},
      status: 'draft',
      validation_state: 'valid',
      history_ref: 'history-1',
      current_revision_ref: null,
      last_audit_event_ref: null,
    });
    state.mapContentListItemMock.mockReturnValue({
      id: 'content-1',
      contentType: 'news.article',
      organizationId: '11111111-1111-4111-8111-111111111111',
    });
    state.deleteContentMock.mockResolvedValue('content-1');
    state.isContentStateValidationErrorMock.mockReturnValue(false);
    state.createApiErrorMock.mockImplementation(
      (status: number, code: string, message: string, requestId?: string) =>
        new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    );
  });

  it('reserves the idempotency key before authorization short-circuits create requests', async () => {
    const response = await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor);

    expect(response.status).toBe(403);
    expect(state.reserveCreateIdempotencyMock).toHaveBeenCalledWith(actor, 'idem-1', '{"contentType":"news.article"}');
    expect(state.authorizeContentActionMock).toHaveBeenCalledWith(
      actor,
      'content.create',
      expect.objectContaining({
        contentType: 'news.article',
        domainCapability: 'content.create',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(state.reserveCreateIdempotencyMock.mock.invocationCallOrder[0]).toBeLessThan(
      state.authorizeContentActionMock.mock.invocationCallOrder[0]
    );
    expect(state.createFailureResponseFromResponseMock).toHaveBeenCalledOnce();
    expect(state.createContentMock).not.toHaveBeenCalled();
  });

  it('returns early for parsed create responses and idempotency replay responses', async () => {
    const parseResponse = new Response('invalid', { status: 400 });
    state.parseCreateRequestMock.mockResolvedValueOnce(parseResponse);
    expect(await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor)).toBe(parseResponse);

    const replayResponse = new Response('replay', { status: 201 });
    state.authorizeContentActionMock.mockResolvedValueOnce(null);
    state.reserveCreateIdempotencyMock.mockResolvedValueOnce(replayResponse);
    expect(await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor)).toBe(replayResponse);
  });

  it('creates content successfully and completes idempotency with the response body', async () => {
    state.authorizeContentActionMock.mockResolvedValueOnce(null);

    const response = await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor);

    expect(response.status).toBe(201);
    expect(state.createContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
        actorAccountId: 'account-1',
        organizationId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(state.completeCreateIdempotencyMock).toHaveBeenCalledOnce();
  });

  it('maps create validation and database failures to the shared failure helpers', async () => {
    state.authorizeContentActionMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    state.createContentMock.mockRejectedValueOnce({ code: 'content_publication_window_invalid' });
    state.isContentStateValidationErrorMock.mockImplementationOnce(
      (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in (error as Record<string, unknown>))
    );

    const validationResponse = await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor);
    expect(validationResponse.status).toBe(400);
    expect(state.createFailureResponseMock).toHaveBeenCalledOnce();

    state.createContentMock.mockRejectedValueOnce(new Error('db down'));
    const failureResponse = await createContentResponse(new Request('https://studio.test/api/v1/iam/contents'), actor);
    expect(failureResponse.status).toBe(503);
    expect(state.logCreateFailureMock).toHaveBeenCalledOnce();
  });

  it('handles update request validation, authorization and success paths', async () => {
    const csrfResponse = new Response('csrf', { status: 403 });
    state.validateCsrfMock.mockReturnValueOnce(csrfResponse);
    expect(await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor)).toBe(csrfResponse);

    state.readPathSegmentMock.mockReturnValueOnce('');
    const missingId = await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(missingId.status).toBe(400);

    state.parseRequestBodyMock.mockResolvedValueOnce({ ok: false, message: 'invalid body' });
    const invalidBody = await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(invalidBody.status).toBe(400);

    state.loadContentByIdMock.mockResolvedValueOnce(undefined);
    const notFound = await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(notFound.status).toBe(404);

    state.authorizeUpdateContentActionsMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const denied = await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(denied.status).toBe(403);

    const ok = await updateContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(ok.status).toBe(200);
    expect(state.updateContentMock).toHaveBeenCalled();
  });

  it('handles delete request validation, authorization and success paths', async () => {
    const csrfResponse = new Response('csrf', { status: 403 });
    state.validateCsrfMock.mockReturnValueOnce(csrfResponse);
    expect(await deleteContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor)).toBe(csrfResponse);

    state.readPathSegmentMock.mockReturnValueOnce('');
    const missingId = await deleteContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(missingId.status).toBe(400);

    state.loadContentRowByIdMock.mockResolvedValueOnce(undefined);
    const notFound = await deleteContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(notFound.status).toBe(404);

    state.authorizeContentActionMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const denied = await deleteContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(denied.status).toBe(403);

    state.authorizeContentActionMock.mockResolvedValueOnce(null);
    const ok = await deleteContentResponse(new Request('https://studio.test/api/v1/iam/contents/content-1'), actor);
    expect(ok.status).toBe(200);
    expect(state.deleteContentMock).toHaveBeenCalled();
  });
});