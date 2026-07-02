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
}));

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
      message: 'Titel fehlt.',
    });
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
    state.getSvaMainserverSurvey.mockResolvedValue(null);

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
      message: 'Nicht erlaubt.',
    });
    expect(deleteResponse?.status).toBe(404);
    await expect(deleteResponse?.json()).resolves.toMatchObject({
      error: 'survey_not_found',
      message: 'Nicht gefunden.',
    });
  });
});
