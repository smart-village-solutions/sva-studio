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

const { createContentResponse } = await import('./mutations.js');

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
    state.isContentStateValidationErrorMock.mockReturnValue(false);
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
});