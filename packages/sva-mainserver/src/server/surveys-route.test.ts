// fallow-ignore-file code-duplication
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  withAuthenticatedUser: vi.fn(),
  authorizeContentPrimitiveForUser: vi.fn(),
  validateCsrf: vi.fn(),
  listSvaMainserverSurveys: vi.fn(),
  getSvaMainserverSurvey: vi.fn(),
  getSvaMainserverSurveyResults: vi.fn(),
  deleteSvaMainserverSurvey: vi.fn(),
  createSvaMainserverSurvey: vi.fn(),
  updateSvaMainserverSurvey: vi.fn(),
  releaseSvaMainserverSurveyFreeTextResponse: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  createSdkLogger: vi.fn(() => ({ info: state.loggerInfo, warn: state.loggerWarn })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('./service.js', () => ({
  listSvaMainserverSurveys: state.listSvaMainserverSurveys,
  getSvaMainserverSurvey: state.getSvaMainserverSurvey,
  getSvaMainserverSurveyResults: state.getSvaMainserverSurveyResults,
  deleteSvaMainserverSurvey: state.deleteSvaMainserverSurvey,
  createSvaMainserverSurvey: state.createSvaMainserverSurvey,
  updateSvaMainserverSurvey: state.updateSvaMainserverSurvey,
  releaseSvaMainserverSurveyFreeTextResponse: state.releaseSvaMainserverSurveyFreeTextResponse,
}));

import { SvaMainserverError } from './errors.js';
import { dispatchSvaMainserverSurveysRequest } from './surveys-route.js';

const ctx = {
  activeOrganizationId: '11111111-1111-1111-8111-111111111111',
  user: {
    id: 'subject-1',
    instanceId: 'de-musterhausen',
  },
};

const createRequest = (url: string, init?: RequestInit): Request =>
  new Request(url, {
    ...init,
    headers: {
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });

const mockAuthorizedRequest = () => {
  state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
  state.validateCsrf.mockReturnValue(null);
  state.authorizeContentPrimitiveForUser.mockResolvedValue({
    ok: true,
    actor: {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      organizationId: '11111111-1111-1111-8111-111111111111',
    },
    permissions: [],
  });
};

describe('dispatchSvaMainserverSurveysRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('ignores unrelated routes', async () => {
    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/news')
    );

    expect(response).toBeNull();
  });

  it('lists surveys after read authorization', async () => {
    mockAuthorizedRequest();
    state.listSvaMainserverSurveys.mockResolvedValue({
      data: [{ id: 'survey-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'survey-1' }],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    expect(state.listSvaMainserverSurveys).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      page: 1,
      pageSize: 25,
    });
  });

  it('does not fetch survey results for detail reads without moderation or export access', async () => {
    mockAuthorizedRequest();
    state.getSvaMainserverSurvey.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage' },
    });
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'subject-1',
          organizationId: '11111111-1111-1111-8111-111111111111',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Moderation nicht erlaubt.',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Export nicht erlaubt.',
      });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: {
        id: 'survey-1',
        title: { de: 'Bestandsumfrage' },
      },
    });
    expect(state.getSvaMainserverSurveyResults).not.toHaveBeenCalled();
  });

  it('fetches survey results for detail reads with export access', async () => {
    mockAuthorizedRequest();
    state.getSvaMainserverSurvey.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage' },
    });
    state.getSvaMainserverSurveyResults.mockResolvedValue({
      surveyId: 'survey-1',
      participationCount: 4,
      submissionCount: 3,
      questions: [],
    });
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'subject-1',
          organizationId: '11111111-1111-1111-8111-111111111111',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Moderation nicht erlaubt.',
      })
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'subject-1',
          organizationId: '11111111-1111-1111-8111-111111111111',
        },
        permissions: [],
      });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: {
        id: 'survey-1',
        title: { de: 'Bestandsumfrage' },
        results: {
          surveyId: 'survey-1',
          participationCount: 4,
          submissionCount: 3,
          questions: [],
        },
      },
    });
    expect(state.getSvaMainserverSurveyResults).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      surveyId: 'survey-1',
    });
  });

  it('propagates moderation or export authorization outages before returning read-only survey details', async () => {
    mockAuthorizedRequest();
    state.getSvaMainserverSurvey.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage' },
    });
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'subject-1',
          organizationId: '11111111-1111-1111-8111-111111111111',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        error: 'database_unavailable',
        message: 'Moderationsrechte derzeit nicht verfügbar.',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Export nicht erlaubt.',
      });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'database_unavailable',
      message: 'Moderationsrechte derzeit nicht verfügbar.',
    });
    expect(state.getSvaMainserverSurveyResults).not.toHaveBeenCalled();
  });

  it('still propagates operational export failures when moderation falls back to a normal denial', async () => {
    mockAuthorizedRequest();
    state.getSvaMainserverSurvey.mockResolvedValue({
      id: 'survey-1',
      title: { de: 'Bestandsumfrage' },
    });
    state.authorizeContentPrimitiveForUser
      .mockResolvedValueOnce({
        ok: true,
        actor: {
          instanceId: 'de-musterhausen',
          keycloakSubject: 'subject-1',
          organizationId: '11111111-1111-1111-8111-111111111111',
        },
        permissions: [],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'forbidden',
        message: 'Moderation nicht erlaubt.',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        error: 'database_unavailable',
        message: 'Exportrechte derzeit nicht verfügbar.',
      });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'database_unavailable',
      message: 'Exportrechte derzeit nicht verfügbar.',
    });
    expect(state.getSvaMainserverSurveyResults).not.toHaveBeenCalled();
  });

  it('deletes surveys after delete authorization', async () => {
    mockAuthorizedRequest();
    state.deleteSvaMainserverSurvey.mockResolvedValue({
      success: true,
      errors: [],
      deletedSurveyId: 'survey-1',
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'DELETE',
      })
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: { id: 'survey-1' },
    });
    expect(state.deleteSvaMainserverSurvey).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      surveyId: 'survey-1',
    });
  });

  it('propagates authorization status and normalized actor data', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'database_unavailable',
      message: 'Autorisierung derzeit nicht verfügbar.',
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys')
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'database_unavailable',
      message: 'Autorisierung derzeit nicht verfügbar.',
    });
  });

  it('returns a mutation error response instead of 2xx when create fails', async () => {
    mockAuthorizedRequest();
    state.createSvaMainserverSurvey.mockResolvedValue({
      success: false,
      errors: [{ code: 'VALIDATION_ERROR', message: 'Titel fehlt.' }],
      survey: null,
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({ title: { de: 'Test' } }),
      })
    );

    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'validation_error',
      message: 'Umfrage konnte nicht angelegt werden.',
    });
  });

  it('creates, updates, and deletes surveys successfully across the route contract', async () => {
    mockAuthorizedRequest();
    state.createSvaMainserverSurvey.mockResolvedValue({
      success: true,
      errors: [],
      survey: { id: 'survey-new', title: { de: 'Neu' } },
    });
    state.updateSvaMainserverSurvey.mockResolvedValue({
      success: true,
      errors: [],
      survey: { id: 'survey-1', title: { de: 'Aktualisiert' } },
    });
    state.deleteSvaMainserverSurvey.mockResolvedValue({
      success: true,
      errors: [],
      deletedSurveyId: 'survey-1',
    });

    const createResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({ title: { de: 'Neu' } }),
      })
    );
    const updateResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: { de: 'Aktualisiert' } }),
      })
    );
    const deleteResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', { method: 'DELETE' })
    );

    expect(createResponse?.status).toBe(201);
    await expect(createResponse?.json()).resolves.toEqual({ data: { id: 'survey-new', title: { de: 'Neu' } } });
    expect(updateResponse?.status).toBe(200);
    await expect(updateResponse?.json()).resolves.toEqual({ data: { id: 'survey-1', title: { de: 'Aktualisiert' } } });
    expect(deleteResponse?.status).toBe(200);
    await expect(deleteResponse?.json()).resolves.toEqual({ data: { id: 'survey-1' } });
  });

  it('uses the authorized actor organization for list calls', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(null);
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'subject-1',
        organizationId: '22222222-2222-2222-8222-222222222222',
      },
      permissions: [],
    });
    state.listSvaMainserverSurveys.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys')
    );

    expect(state.listSvaMainserverSurveys).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '22222222-2222-2222-8222-222222222222',
      page: 1,
      pageSize: 25,
    });
  });

  it('returns method-not-allowed for unsupported collection and item methods', async () => {
    mockAuthorizedRequest();

    const collectionResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', { method: 'PUT' })
    );
    const itemResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', { method: 'POST' })
    );

    expect(collectionResponse?.status).toBe(405);
    await expect(collectionResponse?.json()).resolves.toMatchObject({
      error: 'invalid_request',
    });
    expect(itemResponse?.status).toBe(405);
    await expect(itemResponse?.json()).resolves.toMatchObject({
      error: 'invalid_request',
    });
  });

  it('returns not_found for missing survey detail responses', async () => {
    mockAuthorizedRequest();
    state.getSvaMainserverSurvey.mockImplementation(async () => {
      throw new SvaMainserverError({
        code: 'not_found',
        message: 'Die Umfrage wurde nicht gefunden.',
        statusCode: 404,
      });
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-missing')
    );

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'not_found',
    });
  });

  it('rejects mutating survey requests when csrf validation fails before hitting the service', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.validateCsrf.mockReturnValue(new Response(JSON.stringify({ error: 'csrf_validation_failed' }), { status: 403 }));

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({ title: { de: 'Test' } }),
      })
    );

    expect(response?.status).toBe(403);
    expect(state.createSvaMainserverSurvey).not.toHaveBeenCalled();
    expect(state.authorizeContentPrimitiveForUser).not.toHaveBeenCalled();
  });

  it('maps update and delete mutation failures to their survey-specific error statuses', async () => {
    mockAuthorizedRequest();
    state.updateSvaMainserverSurvey.mockResolvedValue({
      success: false,
      errors: [{ code: 'FORBIDDEN', message: 'Nicht erlaubt.' }],
      survey: null,
    });
    state.deleteSvaMainserverSurvey.mockResolvedValue({
      success: false,
      errors: [{ code: 'SURVEY_NOT_FOUND', message: 'Nicht gefunden.' }],
      deletedSurveyId: null,
    });

    const updateResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: { de: 'Test' } }),
      })
    );
    const deleteResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'DELETE',
      })
    );

    expect(updateResponse?.status).toBe(403);
    await expect(updateResponse?.json()).resolves.toMatchObject({
      error: 'forbidden',
      message: 'Umfrage konnte nicht gespeichert werden.',
    });
    expect(deleteResponse?.status).toBe(404);
    await expect(deleteResponse?.json()).resolves.toMatchObject({
      error: 'survey_not_found',
      message: 'Umfrage konnte nicht gelöscht werden.',
    });
  });

  it('returns validation errors for missing instance context and malformed mutation bodies', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) =>
      handler({
        ...ctx,
        user: {
          ...ctx.user,
          instanceId: undefined,
        },
      })
    );

    const missingInstanceResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys')
    );

    expect(missingInstanceResponse?.status).toBe(400);
    await expect(missingInstanceResponse?.json()).resolves.toMatchObject({
      error: 'invalid_instance_id',
    });

    mockAuthorizedRequest();
    const invalidBodyResponse = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify('not-an-object'),
      })
    );

    expect(invalidBodyResponse?.status).toBe(400);
    await expect(invalidBodyResponse?.json()).resolves.toMatchObject({
      error: 'invalid_request',
    });
    expect(state.createSvaMainserverSurvey).not.toHaveBeenCalled();
  });

  it('rejects structurally invalid survey mutation bodies before hitting the service', async () => {
    mockAuthorizedRequest();

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({
          title: { de: 'Test' },
          targetAreaIds: 'district-1',
          questions: {},
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'invalid_request',
    });
    expect(state.createSvaMainserverSurvey).not.toHaveBeenCalled();
  });

  it('rejects creates without a non-empty localized title before hitting the service', async () => {
    mockAuthorizedRequest();

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({
          title: { de: '   ' },
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'invalid_request',
      message: 'Der Umfrage-Titel ist erforderlich.',
    });
    expect(state.createSvaMainserverSurvey).not.toHaveBeenCalled();
  });

  it('allows null clears for optional localized survey fields during updates', async () => {
    mockAuthorizedRequest();
    state.updateSvaMainserverSurvey.mockResolvedValue({
      success: true,
      errors: [],
      survey: { id: 'survey-1', title: { de: 'Bestandsumfrage' } },
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: { de: 'Bestandsumfrage' },
          shortDescription: null,
          description: null,
          privacyNotice: null,
          transparencyNotice: null,
        }),
      })
    );

    expect(response?.status).toBe(200);
    expect(state.updateSvaMainserverSurvey).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      surveyId: 'survey-1',
      survey: {
        title: { de: 'Bestandsumfrage' },
        shortDescription: null,
        description: null,
        privacyNotice: null,
        transparencyNotice: null,
      },
    });
  });

  it('rejects localized survey fields with non-string locale values before hitting the service', async () => {
    mockAuthorizedRequest();

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys', {
        method: 'POST',
        body: JSON.stringify({
          title: { de: 123 },
        }),
      })
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'invalid_request',
      message: 'Der Umfrage-Titel muss als Objekt mit String-Werten gesendet werden.',
    });
    expect(state.createSvaMainserverSurvey).not.toHaveBeenCalled();
  });

  it('releases free-text responses through the moderation endpoint', async () => {
    mockAuthorizedRequest();
    state.releaseSvaMainserverSurveyFreeTextResponse.mockResolvedValue({
      success: true,
      errors: [],
      survey: { id: 'survey-1' },
    });

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1/free-text-responses/response-1', {
        method: 'PATCH',
      })
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: { id: 'response-1', status: 'PUBLIC' },
    });
    expect(state.releaseSvaMainserverSurveyFreeTextResponse).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'subject-1',
      activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      surveyId: 'survey-1',
      freeTextResponseId: 'response-1',
    });
  });

  it('rejects free-text response deletes that are unsupported by the snapshot moderation schema', async () => {
    mockAuthorizedRequest();

    const response = await dispatchSvaMainserverSurveysRequest(
      createRequest('https://studio.test/api/v1/mainserver/surveys/survey-1/free-text-responses/response-1', {
        method: 'DELETE',
      })
    );

    expect(response?.status).toBe(501);
    await expect(response?.json()).resolves.toEqual({
      error: 'unsupported_operation',
      message: 'Freitext-Löschung wird vom aktuellen Mainserver-Schema nicht unterstützt.',
    });
    expect(state.updateSvaMainserverSurvey).not.toHaveBeenCalled();
  });
});
